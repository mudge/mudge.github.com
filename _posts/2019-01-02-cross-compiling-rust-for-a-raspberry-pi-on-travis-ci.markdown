---
layout: post
title: Cross-Compiling Rust for a Raspberry Pi on Travis CI
excerpt: How to compile binaries from a Rust project that will run on a Raspberry Pi using Travis CI.
redirect_from: /2019/01/02/cross-compiling-rust-for-a-raspberry-pi-on-travis-ci.html
---
I recently wrote a [small program in Rust](https://github.com/mudge/homer) that I wanted to compile for an old [Raspberry Pi](https://www.raspberrypi.org) Model B but running `cargo build --release` on the Pi itself took several hours to complete. Researching online, I found [Jorge Aparicio's guide to Rust cross compilation](https://github.com/japaric/rust-cross) and their [Travis CI and AppVeyor template](https://github.com/japaric/trust) extremely useful but wasn't entirely successful in compiling a binary I could use directly on my device. After many experiments and many failed builds, I finally have a build pipeline that will compile a Rust binary for the Raspberry Pi, Linux and macOS in minutes using [Travis CI](https://travis-ci.org).

## Cross-compiling manually

The first thing we need to understand is how we can compile a Rust program on one architecture but target another and, most importantly, understand the current limitations of cross-compilation with Rust.

Unlike [Go which only requires setting two environment variables to cross-compile to _any_ architecture](https://golangcookbook.com/chapters/running/cross-compiling/), cross-compiling Rust requires us to have a copy of the standard library for the target platform (e.g. in the case of the Raspberry Pi, the standard library needs to be compiled for `arm-unknown-linux-gnueabihf`) and for us to have an appropriate platform-specific linker for compilation. Thankfully, [`rustup` allows us to easily add standard libraries for other platforms](https://github.com/rust-lang/rustup.rs#cross-compilation) but we'll need to source the appropriate linker ourselves.

Finding a platform-specific linker is what restricts us: if there is no toolchain for the target platform available on your build platform then we can't cross-compile. For example, we can't easily compile a binary for the Raspberry Pi from macOS because the [Raspberry Pi toolchain](https://github.com/raspberrypi/tools) doesn't run on macOS.

Luckily for us, it _does_ run on 64-bit Linux so we can use Travis CI to cross-compile as long as we download the Raspberry Pi toolchain and instruct Rust to use its compiler to do the linking. Let's see how this would work if we ran it ourselves on the command-line.

Let's assume we're running this inside our Rust project on a 64-bit Linux machine and we have a recent [`rustup`](https://rustup.rs) installed. We'll start by first downloading the standard library for our target platform: Linux running on an ARMv6 CPU with hardware floating-point support.

```console
$ rustup target add arm-unknown-linux-gnueabihf
info: downloading component 'rust-std' for 'arm-unknown-linux-gnueabihf'
 52.5 MiB /  52.5 MiB (100 %)  26.5 MiB/s ETA:   0 s
info: installing component 'rust-std' for 'arm-unknown-linux-gnueabihf'
```

Then let's download the Raspberry Pi toolchain from GitHub (only fetching the latest commit) into `/tmp` and add the necessary binaries to our path:

```console
$ git clone --depth=1 https://github.com/raspberrypi/tools.git /tmp/tools
$ export PATH=/tmp/tools/arm-bcm2708/arm-linux-gnueabihf/bin:$PATH
```

We now need to tell Rust where to find the linker for the `arm-unknown-linux-gnueabihf` target and we can do this in one of two ways:

1. Add configuration to `~/.cargo/config`
2. Set an environment variable

For the first approach, we would add the following to `~/.cargo/config` (creating it if it does not already exist):

```toml
[target.arm-unknown-linux-gnueabihf]
linker = "arm-linux-gnueabihf-gcc"
```

For the second, we need to export an environment variable for the specific target:

```console
$ export CARGO_TARGET_ARM_UNKNOWN_LINUX_GNUEABIHF_LINKER=arm-linux-gnueabihf-gcc
```

With either of those in place, we can now attempt to compile our project for the target platform with `cargo`:

```console
$ cargo build --target=arm-unknown-linux-gnueabihf --release
```

If you're lucky, this will work and produce a binary in `target/arm-unknown-linux-gnueabihf/release/` that you can run on your target platform. However, I ran into issues trying to compile parts of the [`openssl` crate](https://github.com/sfackler/rust-openssl) as it was attempting to find OpenSSL headers for the target platform on my system but they aren't binary compatible.

Thankfully, we can solve this by taking advantage of the [`openssl` crate's `vendored` Cargo feature](https://docs.rs/openssl/0.10.16/openssl/#vendored) which will compile and statically link its _own_ copy of OpenSSL meaning that it will be compiled for the appropriate platform. To do this, we need to add the following dependency to our `Cargo.toml`:

```
openssl = { version = "0.10", features = ["vendored"] }
```

Hopefully you will now have a cross-compiled binary you can run to your heart's content.

## Running on Travis CI

So how can we automate this to run on Travis CI? We can make use of [Travis CI's Build Matrix](https://docs.travis-ci.com/user/build-matrix/) functionality to specify multiple target platforms and run a Bash script before deployment to prepare assets for [deployment to GitHub Releases](https://docs.travis-ci.com/user/deployment/releases/).

Let's start with only one target platform to keep things simple.

First, you'll need to [generate an encrypted GitHub OAuth token to use for the `deploy` configuration](https://docs.travis-ci.com/user/deployment/releases/#authenticating-with-an-oauth-token). The easiest way to do this is to use the [Travis CLI](https://github.com/travis-ci/travis.rb#installation):

```console
$ gem install travis
$ travis init
$ travis setup releases
```

With that set up, add the following to your `.travis.yml` (leaving your generated `deploy` API key and replacing `mybinary` with your desired name):

```yaml
dist: trusty
language: rust
cache: cargo
env: TARGET=arm-unknown-linux-gnueabihf CARGO_TARGET_ARM_UNKNOWN_LINUX_GNUEABIHF_LINKER=arm-linux-gnueabihf-gcc
before_deploy: ci/before_deploy.sh
deploy:
  file: mybinary-$TRAVIS_TAG-$TARGET.tar.gz
  on:
    tags: true
  provider: releases
  skip_cleanup: true
```

We can now write our `ci/before_deploy.sh` script to perform the steps we did earlier (you'll need to alter the last line to compress the appropriate binary with your desired name as specified in your `.travis.yml` above):

```bash
#!/bin/bash
set -euo pipefail

# Install the Rust stdlib for the current target
rustup target add $TARGET

# Download the Raspberry Pi cross-compilation toolchain if needed
if [ "$TARGET" = "arm-unknown-linux-gnueabihf" ]
then
  git clone --depth=1 https://github.com/raspberrypi/tools.git /tmp/tools
  export PATH=/tmp/tools/arm-bcm2708/arm-linux-gnueabihf/bin:$PATH
fi

# Compile the binary for the current target
cargo build --target=$TARGET --release

# Package up the release binary
tar -C target/$TARGET/release -czf mybinary-$TRAVIS_TAG-$TARGET.tar.gz mybinary
```

Make this file executable:

```console
$ chmod a+x ci/before_deploy.sh
```

You should now be able to build this on Travis CI when pushing a tag and see the release archive pushed automatically to your project.

To add another target platform, e.g. 64-bit Linux, alter your `.travis.yml` by replacing the `env` key with the following:

```yaml
matrix:
  include:
    - env: TARGET=arm-unknown-linux-gnueabihf CARGO_TARGET_ARM_UNKNOWN_LINUX_GNUEABIHF_LINKER=arm-linux-gnueabihf-gcc
    - env: TARGET=x86_64-unknown-linux-gnu
```

This will run two builds, one with the `TARGET` set to `arm-unknown-linux-gnueabihf` (and with the Cargo linker configuration for that platform) and one with the `TARGET` set to `x86_64-unknown-linux-gnu` (as that's the native platform for our build, there's no need to specify a different linker).

For a fully worked example building for the Raspberry Pi, Linux and macOS, see [my lightweight DNS-over-HTTPS proxy, Homer](https://github.com/mudge/homer).
