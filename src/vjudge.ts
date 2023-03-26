import {
  attemptFetch,
  makeProblemGlobalId
} from './utilities';

export const get200AcceptedSubmissionsForHandles = (handles: string[]) => {
  return handles.flatMap(handle =>
    new Array(10).fill(0).map((_, index) => index + 1)
      .flatMap(page => {
        const url = `https://vjudge.net/status/data?draw=${page}&` +
          `start=${(page - 1) * 20}&length=20&un=${handle}&OJId=All&probNum=&` +
          `res=1&language=&onlyFollowee=false&orderBy=run_id&_=${new Date().getTime()}`;
        const [json, ok] = attemptFetch(url, {
          maxAttemptTimes: 10,
          cacheExpirationInSeconds: 60 * 10,
        });
        if (!ok || json === '') {
          return [];
        }
        const fetchedSubmissions = JSON.parse(json) as Vjudge.FetchedSubmissions;

        return fetchedSubmissions.data.map(submission => <Generic.Submission>{
          id: submission.runId,
          handle,
          timeInMs: submission.time,
          problemGlobalId: makeProblemGlobalId(submission.oj, submission.probNum),
          contestId: '_',
          isAccepted: submission.status === 'Accepted',
          isRated: false,
        });
      })
  );
};

export const getSolvedProblems = (handles: string[]) => {
  return Array.from(handles.reduce((accProblems, handle) => {
    const url = `https://vjudge.net/user/solveDetail/${handle}`;
    const [json, ok] = attemptFetch(url, {
      maxAttemptTimes: 10,
      cacheExpirationInSeconds: 60 * 10,
    });
    if (!ok || json === '') {
      return accProblems;
    }

    const solveDetail = JSON.parse(json) as Vjudge.SolveDetail;

    const { acRecords } = solveDetail;

    Object.keys(acRecords).forEach(problemOj => {
      acRecords[problemOj].forEach(problemId => {
        accProblems.add(makeProblemGlobalId(problemOj, problemId));
      });
    });

    return accProblems;

  }, new Set<string>()));
};