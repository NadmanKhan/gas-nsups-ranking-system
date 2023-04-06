import {
  attemptFetch,
  makeProblemGlobalId
} from './utilities';

export const OJ_NAME_ON_VJUDGE = 'CodeForces';
const BASE_URL = 'https://codeforces.com/api';

export const getMaxRatingForHandles = (handles: string[]) => {
  return handles.reduce((accRating, handle) => {
    const url = `${BASE_URL}/user.rating?handle=${handle}`;
    const [json, ok] = attemptFetch(url, {
      maxAttemptTimes: 100,
      checkValid: response => {
        if (response.getResponseCode() !== 200) return false;
        const json = response.getContentText();
        if (json === '') return false;
        const parsed = JSON.parse(json) as Codeforces.Fetched<Codeforces.RatingChange[]>;
        return parsed.status === 'OK';
      },
      isCacheable: () => false,
    });
    if (!ok) {
      return accRating;
    }
    const fetechedRatingChanges = JSON.parse(json) as Codeforces.Fetched<Codeforces.RatingChange[]>;

    const ratingChanges = fetechedRatingChanges.result;
    if (ratingChanges === undefined || ratingChanges.length < 5) {
      return accRating;
    }

    const lastRatingChange = ratingChanges[ratingChanges.length - 1];
    if (lastRatingChange === undefined) {
      return accRating;
    }

    const { newRating } = lastRatingChange;

    return Math.max(accRating, newRating);
  }, 0);
}

export const getContestsOrderedByTimeDesc = () => {
  const url = `${BASE_URL}/contest.list`;
  const [json, ok] = attemptFetch(url, {
    maxAttemptTimes: 100,
    checkValid: response => {
      if (response.getResponseCode() !== 200) return false;
      const json = response.getContentText();
      if (json === '') return false;
      const parsed = JSON.parse(json) as Codeforces.Fetched<Codeforces.Contest[]>;
      return parsed.status === 'OK';
    },
    isCacheable: () => false,
  });
  if (!ok) {
    return [];
  }
  const fetchedContests = JSON.parse(json) as Codeforces.Fetched<Codeforces.Contest[]>;
  return fetchedContests.result.filter(contest => contest.type === 'CF');
};

export const getSubmissionsForHandles = (handles: string[]) => {
  return handles.flatMap(handle => {
    const url = `${BASE_URL}/user.status?handle=${handle}`;
    const [json, ok] = attemptFetch(url, {
      maxAttemptTimes: 100,
      checkValid: response => {
        if (response.getResponseCode() !== 200) return false;
        const json = response.getContentText();
        if (json === '') return false;
        const parsed = JSON.parse(json) as Codeforces.Fetched<Codeforces.Submission[]>;
        return parsed.status === 'OK';
      },
      isCacheable: () => false,
    });
    if (!ok) {
      return [];
    }

    const fetchedSubmissions = JSON.parse(json) as Codeforces.Fetched<Codeforces.Submission[]>;

    const submissions = fetchedSubmissions.result;
    if (submissions === undefined) {
      return [];
    }

    return submissions
      .filter(submission =>
        [submission, submission.problem, submission.author]
          .some(x => x.contestId !== undefined) &&
        submission.verdict !== undefined
      )
      .map(submission => <Generic.Submission>{
        id: submission.id,
        handle,
        timeInMs: submission.creationTimeSeconds * 1000,
        problemGlobalId: makeProblemGlobalId(
          OJ_NAME_ON_VJUDGE,
          submission.problem.contestId.toString() + submission.problem.index
        ),
        contestId: submission.problem.contestId.toString(),
        isAccepted: submission.verdict ? submission.verdict === 'OK' : false,
        isContesting: submission.author.participantType === 'CONTESTANT'
      });
  });
}

export const isContestRatedForRating = (constest: Codeforces.Contest, rating: number) => {
  const divRegexMatch = constest.name.match(/Div.[\s]?(\d)/);
  if (divRegexMatch === null) {
    return false;
  }
  const div = parseInt(divRegexMatch[1]);
  switch (div) {
    case 4: return rating < 1400;
    case 3: return rating < 1600;
    case 2: return rating < 1900;
    case 1: return rating >= 1900;
    default: return false;
  }
};