declare namespace Generic {

  type Submission = {
    id: number;
    handle: string;
    timeInMs: number;
    problemGlobalId: string;
    contestId: string;
    isContesting: boolean;
    isAccepted: boolean;
  };

  type Problem = {
    oj: string;
    id: string;
  };
}

declare namespace Codeforces {

  type Fetched<T> = {
    status: string;
    message?: string;
    result?: T;
  };

  type Contest = {
    id: number;
    name: string;
    type: "CF" | "IOI" | "ICPC";
    phase: "BEFORE" | "CODING" | "PENDING_SYSTEM_TEST" | "SYSTEM_TEST" | "FINISHED";
    frozen: boolean;
    durationSeconds: number;
    startTimeSeconds?: number;
    relativeTimeSeconds?: number;
    preparedBy?: string;
    websiteUrl?: string;
    description?: string;
    difficulty?: number;
    kind?: string;
    icpcRegion?: string;
    country?: string;
    city?: string;
    season?: string;
  };

  type RatingChange = {
    contestId: number;
    contestName: string;
    handle: string;
    rank: number;
    ratingUpdateTimeSeconds: number;
    oldRating: number;
    newRating: number;
  };

  type Submission = {
    id: number;
    contestId?: number;
    creationTimeSeconds: number;
    relativeTimeSeconds: number;
    problem: {
      contestId: number;
      index: string;
      name: string;
      type: string;
      points: number;
      rating: number;
      tags: string[];
    };
    author: {
      contestId: number;
      members: {
        handle: string;
      }[];
      participantType:
      'CONTESTANT' | 'PRACTICE' | 'VIRTUAL' | 'MANAGER' | 'OUT_OF_COMPETITION';
      ghost: boolean;
      startTimeSeconds: number;
    };
    programmingLanguage: string;
    verdict?:
    'FAILED' |
    'OK' |
    'PARTIAL' |
    'COMPILATION_ERROR' |
    'RUNTIME_ERROR' |
    'WRONG_ANSWER' |
    'PRESENTATION_ERROR' |
    'TIME_LIMIT_EXCEEDED' |
    'MEMORY_LIMIT_EXCEEDED' |
    'IDLENESS_LIMIT_EXCEEDED' |
    'SECURITY_VIOLATED' |
    'CRASHED' |
    'INPUT_PREPARATION_CRASHED' |
    'CHALLENGED' |
    'SKIPPED' |
    'TESTING' |
    'REJECTED';
    testset: string;
    passedTestCount: number;
    timeConsumedMillis: number;
    memoryConsumedBytes: number;
  };
}

declare namespace AtCoder {

  type Contest = {
    id: string;
    name: string;
    type: 'ABC' | 'ARC' | 'AGC' | 'AHC' | 'Other';
    startInMs: number;
    lengthInMs: number;
  };

  type Problem = {
    id: string;
    contestId: string;
  };

  namespace KenkooAPI {

    type Submission = {
      id: number;
      epoch_second: number;
      problem_id: string;
      contest_id: string;
      user_id: string;
      language: string;
      point: number;
      length: number;
      result: string;
      execution_time: number;
    };
  }
}

declare namespace Vjudge {

  type FetchedSubmissions = {
    data: Submission[];
    recordsTotal: number;
    recordsFiltered: number;
    draw: number;
  };

  type Submission = {
    memory: number;
    access: number;
    statusType: number;
    avatarUrl: string;
    runtime: number;
    language: string;
    userName: string;
    userId: number;
    languageCanonical: string;
    processing: boolean;
    runId: number;
    time: number;
    oj: string;
    problemId: number;
    sourceLength: number;
    probNum: string;
    status: string;
  };

  type SolveDetail = {
    acRecords: {
      [key: string]: string[]
    };
    failRecords: {
      [key: string]: string[]
    };
  };
}
