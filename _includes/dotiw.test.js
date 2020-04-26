const distanceOfTimeInWords = require("./dotiw");

test("less than a minute", () => {
  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-01T00:00:00Z")
    )
  ).toBe("less than a minute");

  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-01T00:00:29Z")
    )
  ).toBe("less than a minute");
});

test("1 minute", () => {
  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-01T00:00:30Z")
    )
  ).toBe("1 minute");

  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-01T00:01:29Z")
    )
  ).toBe("1 minute");
});

test("2 minutes up to 45 minutes", () => {
  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-01T00:01:30Z")
    )
  ).toBe("2 minutes");

  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-01T00:44:29Z")
    )
  ).toBe("44 minutes");
});

test("45 minutes up to 90 minutes", () => {
  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-01T00:44:30Z")
    )
  ).toBe("about 1 hour");

  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-01T01:29:29Z")
    )
  ).toBe("about 1 hour");
});

test("90 minutes up to 24 hours", () => {
  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-01T01:29:30Z")
    )
  ).toBe("about 2 hours");

  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-01T23:59:29Z")
    )
  ).toBe("about 24 hours");
});

test("24 hours up to 42 hours", () => {
  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-01T23:59:30Z")
    )
  ).toBe("1 day");

  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-02T17:59:29Z")
    )
  ).toBe("1 day");
});

test("42 hours up to 30 days", () => {
  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-02T17:59:30Z")
    )
  ).toBe("2 days");

  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-03T12:00:00Z")
    )
  ).toBe("3 days");

  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-30T23:59:29Z")
    )
  ).toBe("30 days");
});

test("30 days up to 60 days", () => {
  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-01-30T23:59:30Z")
    )
  ).toBe("about 1 month");

  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-02-14T23:59:29Z")
    )
  ).toBe("about 1 month");

  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-02-14T23:59:30Z")
    )
  ).toBe("about 2 months");

  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-02-29T23:59:29Z")
    )
  ).toBe("about 2 months");
});

test("60 days up to 365 days", () => {
  expect(
    distanceOfTimeInWords(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2000-02-29T23:59:30Z")
    )
  ).toBe("2 months");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2005-06-06T21:44:29Z")
    )
  ).toBe("12 months");
});

test("over 365 days", () => {
  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2005-06-06T21:44:30Z")
    )
  ).toBe("about 1 year");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2005-09-05T21:45:00Z")
    )
  ).toBe("about 1 year");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2005-12-06T21:45:00Z")
    )
  ).toBe("over 1 year");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2006-03-07T21:45:00Z")
    )
  ).toBe("almost 2 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2006-09-05T21:45:00Z")
    )
  ).toBe("about 2 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2006-09-07T21:45:00Z")
    )
  ).toBe("over 2 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2007-03-05T21:45:00Z")
    )
  ).toBe("over 2 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2007-03-07T21:45:00Z")
    )
  ).toBe("almost 3 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2009-03-07T21:45:00Z")
    )
  ).toBe("almost 5 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2009-09-05T21:45:00Z")
    )
  ).toBe("about 5 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2009-09-07T21:45:00Z")
    )
  ).toBe("over 5 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2010-03-05T21:45:00Z")
    )
  ).toBe("over 5 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2010-03-07T21:45:00Z")
    )
  ).toBe("almost 6 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2014-03-07T21:45:00Z")
    )
  ).toBe("almost 10 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2014-09-05T21:45:00Z")
    )
  ).toBe("about 10 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2014-09-07T21:45:00Z")
    )
  ).toBe("over 10 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2015-03-05T21:45:00Z")
    )
  ).toBe("over 10 years");

  expect(
    distanceOfTimeInWords(
      new Date("2004-06-06T21:45:00Z"),
      new Date("2015-03-07T21:45:00Z")
    )
  ).toBe("almost 11 years");
});

