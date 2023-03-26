import {
  attemptFetch,
  makeProblemGlobalId
} from './utilities';

export const OJ_NAME_ON_VJUDGE = 'AtCoder';
const BASE_URL = 'https://atcoder.jp';
const SUBMISSIONS_API_URL =
  'https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions';

const REGEX = {
  tbody: /<tbody[\s\S]*?>([\s\S]*?)<\/tbody>/,
  tr: /<tr[\s\S]*?>([\s\S]*?)<\/tr>/g,
  td: /<td[\s\S]*?>([\s\S]*?)<\/td>/g,
  a: /<a([\s\S]*?)>([\s\S]*?)<\/a>/, // captures also attributes (needed for href)
  href: /href=["|'](\S+)["|']/,
  time: /<time[\s\S]*?>([\s\S]*?)<\/time>/,
  span: /<span[\s\S]*?>([\s\S]*?)<\/span>/,
  userRating:
    /<th class="no-break">Rating<\/th><td><span class=\S+>(\d+)<\/span>[\s\S]*?<\/td>/,
} as const;

export const getMemberRating = (handles: string[]) => {
  return handles.reduce((accRating, handle) => {
      const url = `${BASE_URL}/users/${handle}`;
      const [html, ok] = attemptFetch(url, {
        cacheExpirationInSeconds: 60 * 60 * 24,
      });
      if (!ok) return accRating;

      /*
        The rating part in the user's profile looks like this:

        ```
        <tr><th class="no-break">Rating</th><td><span class='user-brown'>725</span>
              </td></tr>
        ```
      */
     
      const matchArray = html.match(REGEX.userRating);
     
      if (matchArray === null) return accRating;
     
      const rating = matchArray[1];

      return Math.max(accRating, parseInt(rating));
    }, 0)
};

export const getContestsOrderedByTimeDesc = () => {
  const contests = [] as AtCoder.Contest[];
  for (let page = 1; ; ++page) {
    const url = `${BASE_URL}/contests/archive?page=${page}`;
    const [html, ok] = attemptFetch(url, {
      checkValid: response => {
        return response.getResponseCode() === 200;
      },
      cacheExpirationInSeconds: 60 * 60 * 24,
    });
    if (!ok || html.toLowerCase().includes('no contests')) break;

    /*    
      In each page, there is one table with one tbody.
      Each tbody has multiple trs, each of which contains the data of a contest.
      The outer html of each tr is like this:

      ```
      <tr>
      <td class="text-center"><a href='http://www.timeanddate.com/worldclock/fixedtime.html?iso=20230204T2100&p1=248' target='blank'><time class='fixtime fixtime-full'>2023-02-04 21:00:00+0900</time></a></td>
        <td >
          <span aria-hidden='true' data-toggle='tooltip' data-placement='top' title="Algorithm">Ⓐ</span>
          
          <span class="user-blue">◉</span>
          <a href="/contests/abc288">Toyota Programming Contest 2023 Spring Qual A（AtCoder Beginner Contest 288）</a>
        </td>
        <td class="text-center">01:40</td>
        <td class="text-center"> - 1999</td>
      </tr>
      ```

      Here,
      - the first td contains the start time of the contest in UTC+9 format
      - the second td contains an anchor with the name, link, and id of the contest
      - the third td contains the length of the contest in HH:MM format
    */

    const { 1: tbody } = html.match(REGEX.tbody);
    const trs = [...tbody.matchAll(REGEX.tr)];

    contests.push(...trs.map(({ 1: tr }) => {
      const [
        { 1: tdWithStartTime },
        { 1: tdWithLinkAndName },
        { 1: tdWithLengthInHHMM },
      ] = [...tr.matchAll(REGEX.td)];

      const { 1: startTimeInUtcPlus9 } = tdWithStartTime.match(REGEX.time);
      const startInMs = new Date(startTimeInUtcPlus9).getTime();

      const [_, href, name] = tdWithLinkAndName.match(REGEX.a);
      const { 1: link } = href.match(REGEX.href);
      const id = link.split('/').pop();

      const type = (() => {
        const nameLower = name.toLocaleLowerCase();
        if (nameLower.includes('beginner')) return 'ABC';
        else if (nameLower.includes('regular')) return 'ARC';
        else if (nameLower.includes('grand')) return 'AGC';
        else if (nameLower.includes('heuristic')) return 'AHC';
        else return 'Other';
      })();

      const lengthInMs = (() => {
        const [hours, minutes] = tdWithLengthInHHMM.split(':').map(parseInt);
        return hours * 60 * 60 * 1000 + minutes * 60 * 1000;
      })();

      return <AtCoder.Contest>{
        id,
        name,
        type,
        startInMs,
        lengthInMs,
      };
    }).filter(contest => ['ABC', 'ARC', 'AGC'].includes(contest.type))
    );
  }

  return contests;
};

const isInContestTime = (() => {
  const contestTimes = new Map(getContestsOrderedByTimeDesc().map(contest =>
    [contest.id, [contest.startInMs, contest.lengthInMs] as const]));
  return (contestId: string, submissionTimeInMs: number) => {
    const [startInMs, lengthInMs] = contestTimes.get(contestId) ?? [0, 0];
    return startInMs <= submissionTimeInMs &&
      submissionTimeInMs <= startInMs + lengthInMs;
  };
})();

export const getSubmissionsForHandles = (handles: string[]) => {
  return handles.flatMap(handle => {
    const submissions = [] as AtCoder.KenkooAPI.Submission[];
    let fromSecond = 0;
    while (true) {
      const url = `${SUBMISSIONS_API_URL}?user=${handle}&from_second=${fromSecond}`;
      const [json, ok] = attemptFetch(url, {
        maxAttemptTimes: 10,
        checkValid: response =>
          response.getResponseCode() === 200 && response.getContentText() !== '',
        cacheExpirationInSeconds: 60 * 15, // 15 minutes
      });
      if (!ok) {
        break;
      }

      const fetchedSubmissions = JSON.parse(json) as AtCoder.KenkooAPI.Submission[];
      if (fetchedSubmissions.length === 0) {
        break;
      }

      submissions.push(...fetchedSubmissions);

      fromSecond = fetchedSubmissions.pop().epoch_second + 1;
    }
    return submissions;

  }).map(submission => {
    return <Generic.Submission>{
      id: submission.id,
      handle: submission.user_id,
      timeInMs: submission.epoch_second * 1000,
      problemGlobalId: makeProblemGlobalId(
        OJ_NAME_ON_VJUDGE, submission.problem_id
      ),
      contestId: submission.contest_id,
      isRated: isInContestTime(submission.contest_id, submission.epoch_second * 1000),
      isAccepted: submission.result === 'AC',
    };
  });
};

export const getSubmissionsForHandlesByContests = (
  handles: string[],
  contests: AtCoder.Contest[]
) => {
  return contests.flatMap(contest =>
    handles.flatMap(handle => {
      const userSubmissions: Generic.Submission[] = [];
      for (let page = 1; ; ++page) {
        const url = `${BASE_URL}/contests/${contest.id}/submissions?f.User=${handle}&page=${page}`;
        const [html, ok] = attemptFetch(url, {
          checkValid: response => {
            return response.getResponseCode() === 200;
          },
          cacheExpirationInSeconds: 60 * 60 * 24, // 1 day
        });
        if (!ok || html.toLocaleLowerCase().includes('no submissions')) break;

        /*
          In each page, there is one table with one tbody.
          Each tbody has multiple trs, each of which contains the data of a submission.
          The outer html of each tr is like this:

          ```
          <tr>
            
            <td class="no-break"><time class='fixtime fixtime-second'>2023-02-26 21:04:10+0900</time></td>
            <td><a href="/contests/abc291/tasks/abc291_b">B - Trimmed Mean</a></td>
            <td><a href="/users/glo">glo</a> <a href='/contests/abc291/submissions?f.User=glo'><span class='glyphicon glyphicon-search black' aria-hidden='true' data-toggle='tooltip' title='view glo's submissions'></span></a></td>
            <td><a href="/contests/abc291/submissions?f.Language=4047&amp;f.User=glo">PyPy3 (7.3.0)</a></td>
            <td class="text-right submission-score" data-id="39229848">200</td>
            <td class="text-right">90 Byte</td>
            <td class='text-center'><span class='label label-success' data-toggle='tooltip' data-placement='top' title="Accepted">AC</span></td><td class='text-right'>64 ms</td><td class='text-right'>61912 KB</td>
            <td class="text-center">
              <a href="/contests/abc291/submissions/39229848">Detail</a>
            </td>
          </tr>
          ```

          Here,
          - the first td contains a time element with the submission's time
          - the second td contains an anchor with the problem's link (with the id)
          - the third td contains two anchors, the first one with the user's link (with the handle)
          - the seventh td contains a span with the submission's status      
        */

        const { 1: tbody } = html.match(REGEX.tbody);
        const trs = [...tbody.matchAll(REGEX.tr)];

        trs.forEach(({ 1: tr }) => {
          const {
            0: { 1: tdWithTime },
            1: { 1: tdWithProblemLink },
            6: { 1: tdWithStatus },
          } = [...tr.matchAll(REGEX.td)];

          const { 1: timeInUtcPlus9 } = tdWithTime.match(REGEX.time);
          const timeInMs = new Date(timeInUtcPlus9).getTime();

          const { 1: problemLink } = tdWithProblemLink.match(REGEX.a);
          const { 1: problemLinkHref } = problemLink.match(REGEX.href);
          const problemId = problemLinkHref.split('/').pop();
          const contestId = problemId.split('_')[0];

          const { 1: status } = tdWithStatus.match(REGEX.span);
          const isAccepted = status === 'AC';

          userSubmissions.push(<Generic.Submission>{
            handle,
            problemGlobalId: makeProblemGlobalId(OJ_NAME_ON_VJUDGE, problemId),
            timeInMs,
            isAccepted,
            isRated: isInContestTime(contestId, timeInMs),
            contestId,
          });
        });
      }
      return userSubmissions;
    })
  );
};

export const isContestRatedForRating = (contest: AtCoder.Contest, rating: number) => {
  return contest.type === 'ABC';
};