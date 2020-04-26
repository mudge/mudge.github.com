function distanceOfTimeInWords(from, to) {
  var milliseconds = to - from,
      seconds = Math.round(milliseconds / 1000),
      minutes = Math.round(seconds / 60),
      fromYear = from.getFullYear(),
      toYear = to.getFullYear(),
      leapYears, leapDayMinutes, minutesWithoutLeapDays, years, remainingMinutes;

  if (minutes === 0) {
    return "less than a minute";
  }

  if (minutes === 1) {
    return "1 minute";
  }

  if (minutes < 45) {
    return minutes + " minutes";
  }

  if (minutes < 90) {
    return "about 1 hour";
  }

  if (minutes < 1440) {
    return "about " + Math.round(minutes / 60) + " hours";
  }

  if (minutes < 2520) {
    return "1 day";
  }

  if (minutes < 43200) {
    return Math.round(minutes / 1440) + " days";
  }

  if (minutes < 64800) {
    return "about 1 month";
  }

  if (minutes < 86400) {
    return "about " + Math.round(minutes / 43200) + " months";
  }

  if (minutes < 525600) {
    return Math.round(minutes / 43200) + " months";
  }

  if (from.getMonth() >= 2) {
    fromYear++;
  }

  if (to.getMonth() < 2) {
    toYear--;
  }

  toYear--;

  leapYears = (Math.floor(toYear / 4) - Math.floor(toYear / 100) + Math.floor(toYear / 400)) -
    (Math.floor(fromYear / 4) - Math.floor(fromYear / 100) + Math.floor(fromYear / 400));

  leapDayMinutes = leapYears * 1440;
  minutesWithoutLeapDays = minutes - leapDayMinutes;
  remainingMinutes = minutesWithoutLeapDays % 525600;
  years = Math.floor(minutesWithoutLeapDays / 525600);

  if (remainingMinutes < 131400) {
    return "about " + years + " year" + (years === 1 ? "" : "s");
  }

  if (remainingMinutes < 394200) {
    return "over " + years + " year" + (years === 1 ? "" : "s");
  }

  return "almost " + (years + 1) + " years";
}

if (typeof module === "object" && module.exports) {
  module.exports = distanceOfTimeInWords;
}

