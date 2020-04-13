(function () {
  var container = document.getElementById("dotiw"),
      postDate = new Date(container.nextSibling.nextSibling.dateTime),

      isLeapYear = function (year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      },

      numberOfLeapYearsBetween = function (fromYear, toYear) {
        var leapYears = 0, year;

        for (year = fromYear; year < toYear; year += 1) {
          if (isLeapYear(year)) {
            leapYears += 1;
          }
        }

        return leapYears;
      },

      distanceInYearsBetween = function (fromTime, toTime) {
        var fromYear = fromTime.getYear() + (fromTime.getMonth() >= 2 ? 1 : 0),
            toYear = toTime.getYear() - (toTime.getMonth() < 2 ? 1 : 0),
            distanceInMinutes = Math.round((toTime - fromTime) / 1000 / 60),
            minuteOffsetForLeapYear = numberOfLeapYearsBetween(fromYear, toYear) * 1440,
            minutesWithOffset = distanceInMinutes - minuteOffsetForLeapYear,
            remainder = minutesWithOffset % 525600,
            distanceInYears = Math.round(minutesWithOffset / 525600);

        return [distanceInYears, remainder];
      },

      distanceOfTimeInWords = function (fromTime, toTime) {
        var distanceInMilliseconds = toTime - fromTime,
            distanceInSeconds = Math.round(distanceInMilliseconds / 1000),
            distanceInMinutes = Math.round(distanceInSeconds / 60),
            distanceInYearsAndRemainder = distanceInYearsBetween(fromTime, toTime),
            distanceInYears = distanceInYearsAndRemainder[0],
            remainder = distanceInYearsAndRemainder[1];

        if (distanceInMinutes === 0) {
          return "less than 1 minute";
        } else if (distanceInMinutes === 1) {
          return "1 minute";
        } else if (distanceInMinutes >= 2 && distanceInMinutes < 45) {
          return distanceInMinutes + " minutes";
        } else if (distanceInMinutes >= 45 && distanceInMinutes < 90) {
          return "about 1 hour";
        } else if (distanceInMinutes >= 90 && distanceInMinutes < 1440) {
          return "about " + Math.round(distanceInMinutes / 60) + " hours";
        } else if (distanceInMinutes >= 1440 && distanceInMinutes < 2520) {
          return "1 day";
        } else if (distanceInMinutes >= 2520 && distanceInMinutes < 43200) {
          return Math.round(distanceInMinutes / 1440) + " days";
        } else if (distanceInMinutes >= 43200 && distanceInMinutes < 64800) {
          return "about 1 month";
        } else if (distanceInMinutes >= 64800 && distanceInMinutes < 86400) {
          return "about " + Math.round(distanceInMinutes / 43200) + " months";
        } else if (distanceInMinutes >= 86400 && distanceInMinutes < 525600) {
          return Math.round(distanceInMinutes / 43200) + " months";
        } else if (remainder < 131400) {
          return "about " + distanceInYears + " year" + (distanceInYears === 1 ? "" : "s");
        } else if (remainder < 394200) {
          return "over " + distanceInYears + " year" + (distanceInYears === 1 ? "" : "s");
        } else {
          return "almost " + (distanceInYears + 1) + " years";
        }
      },

      render = function () {
        container.innerHTML = distanceOfTimeInWords(postDate, new Date()) + " ago";
      };

  render();
  setInterval(render, 60000);
}());

