export function toDateString(date: Date) {
  const offset = date.getTimezoneOffset();
  const offsetDate = new Date(date.getTime() - offset * 60 * 1000);
  const [dateString] = offsetDate.toISOString().split('T');
  return dateString;
}

export function calculateTimeDifference(
  sleepStartTimestampGMT: number,
  sleepEndTimestampGMT: number,
): { hours: number; minutes: number } {
  // Calculate time difference in seconds
  const timeDifferenceInSeconds = (sleepEndTimestampGMT - sleepStartTimestampGMT) / 1000;

  // Convert time difference to hours and minutes
  const hours = Math.floor(timeDifferenceInSeconds / 3600);
  const minutes = Math.floor((timeDifferenceInSeconds % 3600) / 60);

  return {
    hours,
    minutes,
  };
}

export function getLocalTimestamp(date: Date, timezone: string) {
  // TODO dimfred: Fix timezone handling - the original logic was causing "Date value out of bounds" errors
  // TODO 2 it seems this is fine?, Just monitor it
  // For now, just return the ISO string. Timezone param is kept for API compatibility.
  // const localTimestampISO = date.toISOString().substring(0, 23);
  // const localTimestamp = new Date(localTimestampISO).toLocaleString('en-US', {
  //   timeZone: timezone,
  //   hour12: false
  // });

  // const formattedLocalTimestamp = new Date(localTimestamp)
  //   .toISOString()
  //   .substring(0, 23);
  // return formattedLocalTimestamp;

  return date.toISOString().substring(0, 23);
}
