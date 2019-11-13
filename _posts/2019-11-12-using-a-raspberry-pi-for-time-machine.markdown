---
layout: post
title: Using a Raspberry Pi for Time Machine
excerpt: How to share a disk with Samba and Avahi on a Raspberry Pi for use with macOS backups.
comments: false
image: /i/timemachine.png
---
<img src="/i/timemachine.png" class="pull-right" width="360" height="246" alt=""> Ever since [Mac OS X Leopard](https://en.wikipedia.org/wiki/Mac_OS_X_Leopard), connecting an external storage device to your Mac will ask you if you want to use that storage to automatically back up all of your files with a feature called [Time Machine](https://support.apple.com/en-us/HT201250). However, Time Machine can also be configured to [back up to storage elsewhere on your network](https://support.apple.com/en-gb/HT202784#nas) and not directly connected to your computer.

We're going to use a [Raspberry Pi](https://www.raspberrypi.org) (I used an old Model B) as a cheap alternative to a dedicated Network-attached Storage (NAS) device for use with Time Machine. I'm going to use an external hard drive connected via USB but the same principles should apply to any storage available to the Raspberry Pi.

## Software dependencies

First, ensure you're using a recent version of [Raspbian](https://www.raspberrypi.org/downloads/raspbian/) so we can rely entirely on Debian packages already built for your Raspberry Pi and avoid compiling software ourselves (which can take quite some time on older models). If not, please see the [official documentation for installing a Raspberry Pi operating system image on an SD card](https://www.raspberrypi.org/documentation/installation/installing-images/README.md). At the time of writing, I used the September 2019 version of Raspbian Buster with a kernel version of 4.19.

With Raspbian up and running, let's install the two packages we're going to need: [Samba](https://www.samba.org) and the [Avahi](https://www.avahi.org) daemon.

```console
pi@raspberrypi:~ $ sudo apt install samba avahi-daemon
```

Samba is an open source implementation of the SMB file sharing protocol which is [officially supported by Time Machine](https://developer.apple.com/library/archive/releasenotes/NetworkingInternetWeb/Time_Machine_SMB_Spec/index.html) for backing up over a network. This is all we really need to back up to storage attached to our Raspberry Pi but we can make it slightly easier to set up on the macOS end by also using Avahi's implementation of the mDNS/DNS-SD protocol (sometimes called ["Bonjour"](https://en.wikipedia.org/wiki/Bonjour_(software))) to make our Time Machine share automatically discoverable on our network. This way we don't need to manually connect to our Raspberry Pi from our Mac, it will automatically appear both in the Finder's sidebar and in the Time Machine System Preferences.

Note that we are _not_ using [Netatalk](http://netatalk.sourceforge.net) as we want to use SMB rather than AFP for file sharing as that seems to be the preferred file sharing protocol for network-attached storage in [Apple's current documentation](https://support.apple.com/en-gb/HT202784#nas).

## Readying our storage

With our dependencies in place, let's ready our storage. If you have this set up already, please feel free to [skip ahead to Samba configuration](#configuring-samba).

I use a cheap USB enclosure with a 500 GB hard disk inside and I want to use the whole disk for Time Machine. Connecting it to my Raspberry Pi makes it instantly discoverable with `blkid` which will print attributes for all connected block devices:

```console
pi@raspberrypi:~ $ sudo blkid
/dev/mmcblk0p1: LABEL_FATBOOT="boot" LABEL="boot" UUID="3725-1C05" TYPE="vfat" PARTUUID="d565a392-01"
/dev/mmcblk0p2: LABEL="rootfs" UUID="fd695ef5-f047-44bd-b159-2a78c53af20a" TYPE="ext4" PARTUUID="d565a392-02"
/dev/sda: UUID="e613b4f3-7fb8-463a-a65d-42a14148ea65" TYPE="ext4"
/dev/mmcblk0: PTUUID="d565a392" PTTYPE="dos"
```

The key entry here is `/dev/sda`: that's my USB drive and its unique ID I can use when configuring it.

As the `TYPE="ext4"` in the output reveals, I've already formatted it with the default Linux [ext4 journaling file system](https://en.wikipedia.org/wiki/Ext4) but let's do it again for good measure:

```console
pi@raspberrypi:~ $ sudo mkfs -t ext4 /dev/sda
```

Note this isn't an encrypted file system so anyone can read anything written to it. We could use [Linux Unified Key Setup](https://en.wikipedia.org/wiki/Linux_Unified_Key_Setup) to avoid this but Time Machine will store any network backups in a [sparse image](https://en.wikipedia.org/wiki/Sparse_image) which can itself be encrypted. To simplify setup, let's rely on Time Machine's encryption to keep our backups secure and leave our underlying storage unencrypted.

Now we want to mount this filesystem on our Raspberry Pi so that we can access it like any other directory. Let's do this and ensure that the mount persists whenever the Raspberry Pi restarts by appending an entry to the `fstab`:

```console
pi@raspberrypi:~ $ echo 'UUID=e613b4f3-7fb8-463a-a65d-42a14148ea65	/media	ext4	sync,noexec,nodev,noatime,nodiratime	0	0' | sudo tee -a /etc/fstab
```

This instructs our Raspberry Pi to mount the drive identified by the given UUID (which we got earlier when calling `blkid`) at the directory `/media` as an ext4 filesystem with a variety of flags:

* `sync`: all writes to the drive should be done synchronously;
* `noexec`: do not allow direct execution of any binaries on the mounted filesystem as it's only going to be use for backup storage;
* `nodev`: do not interpret character or block special devices on the filesystem;
* `noatime`: do not store access times on this filesystem;
* `nodiratime`: do not store directory access times on this filesystem.

The two numbers at the end of the line instruct your Raspberry Pi to ignore this filesystem when using `dump` and not to check it with `fsck` when rebooting.

I'm using `/media` because I have no other storage attached to my Raspberry Pi but you could use any directory of your choice.

Now we can actually mount the filesystem based on the definition we just added to our `fstab`:

```console
pi@raspberrypi:~ $ sudo mount /media
```

This allows us to now read and write files on our freshly formatted USB drive.

Let's create a separate user for storing backups to match the one on my Mac:

```console
pi@raspberrypi:~ $ sudo adduser mudge
```

Let's store all our backups in a new directory and assign ownership of the entire disk to this new user:

```console
pi@raspberrypi:~ $ sudo mkdir /media/backups
pi@raspberrypi:~ $ sudo chown -R mudge: /media
```

As I'm using a spinning disk and Time Machine doesn't run constantly, it'd be nice if we could put the disk in standby after 10 minutes of inactivity. To do this, we'll need to install `hdparm` to set a standby (spindown) timeout in 5 second increments, again identifying our disk by its UUID:

```console
pi@raspberrypi:~ $ sudo apt install hdparm
pi@raspberrypi:~ $ sudo hdparm -S 120 /dev/disk/by-uuid/e613b4f3-7fb8-463a-a65d-42a14148ea65
```

We can make this permanent by adding the following stanza to `/etc/hdparm.conf`:

```
/dev/disk/by-uuid/e613b4f3-7fb8-463a-a65d-42a14148ea65 {
	spindown_time = 120
}
```

## Configuring Samba

Now that we have storage available to share with our Mac, let's set it up with Samba so that it will work with Time Machine.

To do this, we need to do two things:

1. Ensure that [`map to guest`](https://www.samba.org/samba/docs/current/man-html/smb.conf.5.html#MAPTOGUEST) is set to its default value of `Never` so that invalid passwords are rejected;
2. Add a new section to `/etc/samba/smb.conf` for your shared directory.

At the time of writing, the default `smb.conf` contains the following configuration:

```
# This option controls how unsuccessful authentication attempts are mapped
# to anonymous connections
   map to guest = bad user
```

This will cause problems when trying to browse your shared directory in the Finder so simply comment it out with a semicolon to reset it to its default value of `Never`:

```
# This option controls how unsuccessful authentication attempts are mapped
# to anonymous connections
;   map to guest = bad user
```

Now we can add our new share definition for our directory at `/media/backups` owned by the user `mudge`:

```
[backups]
    comment = Backups
    path = /media/backups
    valid users = mudge
    read only = no
    vfs objects = catia fruit streams_xattr
    fruit:time machine = yes
```

This creates a new share called `backups` which can only be accessed by using the `mudge` username and password.

The key configuration for Time Machine are the last two lines which enable [Samba's enhanced macOS interoperability module](https://www.samba.org/samba/docs/current/man-html/vfs_fruit.8.html).

With these changes in place, we can now run `testparm` to check our configuration is free of errors and reload our Samba configuration:

```console
pi@raspberrypi:~ $ sudo testparm
pi@raspberrypi:~ $ sudo service smbd reload
```

## Configuring Avahi

<img src="/i/sidebar.png" class="pull-right" width="375" height="243" alt=""> Now that Samba is configured, let's use Avahi to advertise it to Macs on our network. While Samba can do this itself if it is built with mDNS support, the version currently available for Raspbian does not have this functionality so we'll have to do it ourselves based on the [Samba source code](https://github.com/samba-team/samba/blob/master/source3/smbd/avahi_register.c).

We're going to have to add a new Avahi service to `/etc/avahi/services/samba.service` which describes the two things [described in Apple's documentation for advertising Time Machine availability through Bonjour](https://developer.apple.com/library/archive/releasenotes/NetworkingInternetWeb/Time_Machine_SMB_Spec/index.html#//apple_ref/doc/uid/TP40017496-CH1-SW1):

1. We are running an SMB server on port 445;
2. We have an SMB share point available for Time Machine.

As a bonus, we're also going to advertise our Raspberry Pi as a now-defunct [AirPort Time Capsule](https://en.wikipedia.org/wiki/AirPort_Time_Capsule) so that it appears as such in the Finder.

```xml
<?xml version="1.0" standalone='no'?><!--*-nxml-*-->
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">%h</name>
  <service>
    <type>_smb._tcp</type>
    <port>445</port>
  </service>
  <service>
    <type>_device-info._tcp</type>
    <port>0</port>
    <txt-record>model=TimeCapsule8,119</txt-record>
  </service>
  <service>
    <type>_adisk._tcp</type>
    <port>0</port>
    <txt-record>dk0=adVN=backups,adVF=0x82</txt-record>
    <txt-record>sys=adVF=0x100</txt-record>
  </service>
</service-group>
```

Let's take a look at each `service` individually:

```xml
<service>
  <type>_smb._tcp</type>
  <port>445</port>
</service>
```

This advertises our SMB server on port 445.

```xml
<service>
  <type>_device-info._tcp</type>
  <port>0</port>
  <txt-record>model=TimeCapsule8,119</txt-record>
</service>
```

This advertises our Raspberry Pi as an AirPort Time Capsule but you can use any device model name found in `/System/Library/CoreServices/CoreTypes.bundle/Contents/Info.plist`, e.g. `MacBook`, `Xserve`, `Windows`, etc.

```xml
<service>
  <type>_adisk._tcp</type>
  <port>0</port>
  <txt-record>dk0=adVN=backups,adVF=0x82</txt-record>
  <txt-record>sys=adVF=0x100</txt-record>
</service>
```

This is the crucial part that advertises our specific `backups` share as a Time Machine-compatible "AirDisk" and it consists of two parts:

```xml
<txt-record>dk0=adVN=backups,adVF=0x82</txt-record>
```

Advertise a share named `backups` which has the following two AirDisk volume flags set:

1. `0x0002`: SMB is supported on this volume;
2. `0x0080`: Time Machine should allow this SMB volume as a backup destination.

Together, these make the single hex value string of `0x82`.

The second part sets system-wide [volume flags](http://netatalk.sourceforge.net/wiki/index.php/Bonjour_record_adisk_adVF_values) of `0x100` so that connecting to any share prompts for a username and password:

```xml
<txt-record>sys=adVF=0x100</txt-record>
```

With this service file in place, Avahi should automatically pick up the configuration change and your Raspberry Pi will now appear in the Finder and in the Time Machine Preference Pane when you choose "Select Disk...".

Ensure that you check "Encrypt backups" when selecting the disk and wait for your first backup to complete!
