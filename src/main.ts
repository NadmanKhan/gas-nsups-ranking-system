import * as cf from './codeforces';
import * as ac from './atcoder';
import * as vj from './vjudge';
import {
  getPercentileRankMap,
} from './utilities';

type Member = {
  name: string;
  id: string;
  handles: {
    vjudge: string[];
    codeforces: string[];
    atcoder: string[];
  }
};

const members = (() => {
  const splitTrimFilter = (s: string) =>
    s.split(',').map(s => s.trim()).filter(s => s !== '');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
  return sheet.getRange(2, 1,
    sheet.getLastRow() - 1, sheet.getLastColumn()).getValues()
    .filter(row => (row[1] as string) === 'active')
    .map(row => <Member>{
      name: row[0] as string,
      id: row[2] as string,
      handles: {
        vjudge: splitTrimFilter(row[5] as string),
        codeforces: splitTrimFilter(row[6] as string),
        atcoder: splitTrimFilter(row[7] as string),
      }
    })
    .filter(member => member.id !== '');
})();

const ratingMap = (() => {
  return members.reduce((map, member) => {
    map.set(member.id, {
      codeforces: cf.getMemberRating(member.handles.codeforces),
      atcoder: ac.getMemberRating(member.handles.atcoder),
    });
    return map;
  }, new Map<string, { codeforces: number, atcoder: number }>());
})();

const submissionsMap = (() => {
  return members.reduce((map, member) => {
    map.set(member.id, {
      codeforces: cf.getSubmissionsForHandles(member.handles.codeforces),
      atcoder: ac.getSubmissionsForHandles(member.handles.atcoder),
      vjudge: vj.get200AcceptedSubmissionsForHandles(member.handles.vjudge),
    });
    return map;
  }, new Map<string, {
    codeforces: Generic.Submission[],
    atcoder: Generic.Submission[],
    vjudge: Generic.Submission[],
  }>());
})();

const totalSolveCountMap = (() => {
  return members.reduce((map, member) => {
    const solved = new Set<string>();
    const submissions = submissionsMap.get(member.id) || {
      codeforces: [],
      atcoder: [],
      vjudge: [],
    };
    [
      ...submissions.codeforces,
      ...submissions.atcoder,
      ...submissions.vjudge,
    ]
      .filter(submission => submission.isAccepted)
      .forEach(submission => {
        solved.add(submission.problemGlobalId);
      })

    vj.getSolvedProblems(member.handles.vjudge).forEach(problemId => {
      solved.add(problemId);
    });

    map.set(member.id, solved.size);
    return map;
  }, new Map<string, number>());
})();

const solveCount90DaysMap = (() => {
  const time90DaysBackInMs = new Date().getTime() - 90 * 24 * 60 * 60 * 1000;
  return members.reduce((map, member) => {
    const solvedSofar = new Set<string>();
    const counts = new Array<number>(90).fill(0);
    const submissions = submissionsMap.get(member.id) || {
      codeforces: [],
      atcoder: [],
      vjudge: [],
    };
    [
      ...submissions.codeforces,
      ...submissions.atcoder,
      ...submissions.vjudge,
    ]
      .filter(submission =>
        submission.isAccepted && submission.timeInMs >= time90DaysBackInMs
      )
      .sort((a, b) => a.timeInMs - b.timeInMs)
      .forEach(submission => {
        if (solvedSofar.has(submission.problemGlobalId)) {
          return;
        }
        solvedSofar.add(submission.problemGlobalId);

        // [today, yesterday, ..., 89 days and 23:59:59.999... ago]

        const daysAgo = Math.floor((new Date().getTime() - submission.timeInMs) /
          (24 * 60 * 60 * 1000));

        counts[daysAgo] += 1;
      }
      );
    map.set(member.id, counts);
    return map;
  }, new Map<string, number[]>());
})();

const hasParticipatedInContestsMap = (() => {
  const cfContests = cf.getContestsOrderedByTimeDesc();
  const acContests = ac.getContestsOrderedByTimeDesc();
  return members.reduce((map, member) => {
    const submissions = submissionsMap.get(member.id) || {
      codeforces: [],
      atcoder: [],
      vjudge: [],
    };
    const cfContestWithRatedSolve = new Set(
      submissions.codeforces
        .filter(sub => sub.isRated)
        .map(sub => sub.contestId)
    );
    const acContestsWithRatedSolve = new Set(
      submissions.atcoder
        .filter(sub => sub.isRated)
        .map(sub => sub.contestId)
    );
    const cfContestsRatedForMember = cfContests.filter(contest =>
      cf.isContestRatedForRating(contest, ratingMap.get(member.id)?.codeforces || 0));
    const acContestsRatedForMember = acContests.filter(contest =>
      ac.isContestRatedForRating(contest, ratingMap.get(member.id)?.atcoder || 0));
    map.set(member.id, {
      codeforces: cfContestsRatedForMember.map(contest =>
        cfContestWithRatedSolve.has(contest.id.toString())),
      atcoder: acContestsRatedForMember.map(contest =>
        acContestsWithRatedSolve.has(contest.id))
    });
    return map;
  }, new Map<string, { codeforces: boolean[], atcoder: boolean[] }>());
})();

const scoresGetter = {
  'Codeforces Rating Percentile': (() => {
    const map = getPercentileRankMap(
      members.map(member => ({
        id: member.id,
        score: ratingMap.get(member.id)?.codeforces || 0,
      }))
    )
    return (memberId: string) => {
      const res = map.get(memberId) || { rank: 0, score: 0 };
      return {
        raw: res.score,
        normalized: res.rank,
      };
    };
  }),
  'AtCoder Rating Percentile': (() => {
    const map = getPercentileRankMap(
      members.map(member => ({
        id: member.id,
        score: ratingMap.get(member.id)?.atcoder || 0,
      }))
    )
    return (memberId: string) => {
      const res = map.get(memberId) || { rank: 0, score: 0 };
      return {
        raw: res.score,
        normalized: res.rank,
      };
    };
  }),
  'Percentile of Total Solved Problems': (() => {
    const map = getPercentileRankMap(
      members.map(member => ({
        id: member.id,
        score: totalSolveCountMap.get(member.id) || 0,
      }))
    )
    return (memberId: string) => {
      const res = map.get(memberId) || { rank: 0, score: 0 };
      return {
        raw: res.score,
        normalized: res.rank,
      };
    };
  }),
  'Percentage of Practice Days: Last 30 Days': (() => {
    const map = members.reduce((map, member) => {
      map.set(member.id, solveCount90DaysMap.get(member.id)?.slice(0, 30).reduce(
        (sum, count) => sum + Number(Boolean(count)), 0) || 0);
      return map;
    }, new Map<string, number>());
    return (memberId: string) => {
      const res = map.get(memberId) || 0;
      return {
        raw: res,
        normalized: Math.round((res * 100) / 30),
      };
    };
  }),
} as const;

type RatingComponent = {
  name: keyof typeof scoresGetter;
  weight: number;
  getScores: (memberId: string) => { raw: number, normalized: number };
};

const ratingComponents = (() => {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rating Components');
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .getValues()
    .map(row => <RatingComponent>{
      name: row[0] as keyof typeof scoresGetter,
      weight: parseInt(row[1]),
      getScores: scoresGetter[row[0]](),
    });
})();

const taskCompletionGetter = {
  'Codeforces Contest Participation': ((considered: number) => {
    return (memberId: string) =>
      hasParticipatedInContestsMap.get(memberId)?.codeforces.slice(0,
        considered).reduce((sum, hasParticipated) => sum + Number(hasParticipated), 0)
      || 0;
  }),
  'AtCoder Contest Participation': ((considered: number) => {
    return (memberId: string) =>
      hasParticipatedInContestsMap.get(memberId)?.atcoder.slice(0,
        considered).reduce((sum, hasParticipated) => sum + Number(hasParticipated), 0)
      || 0;
  }),
  'Practice Days': ((considered: number) => {
    return (memberId: string) =>
      solveCount90DaysMap.get(memberId)?.slice(0, considered).reduce(
        (sum, count) => sum + Number(Boolean(count)), 0)
      || 0;
  }),
} as const;

type RatingEligibilityTask = {
  name: keyof typeof taskCompletionGetter;
  considered: number;
  required: number;
  getCompletion: (memberId: string) => number;
};

const ratingEligibilityTasks = (() => {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rated Eligibility Tasks');
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .getValues()
    .map(row => <RatingEligibilityTask>{
      name: row[0] as keyof typeof taskCompletionGetter,
      considered: parseInt(row[1]),
      required: parseInt(row[2]),
      getCompletion: taskCompletionGetter[row[0]](parseInt(row[1]))
    });
})();

type MemberSummary = {
  id: string;
  name: string;
  aggregateRating: number;
  ratingComponents: { name: string, raw: number, normalized: number }[];
  isRated: boolean;
  ratingEligibilityTasks: { name: string, completion: number, isEligible: boolean }[];
};

const memberSummaries = members.map(member => {
  return <MemberSummary>{
    id: member.id,
    name: member.name,
    aggregateRating: Math.round(
      ratingComponents.reduce((sum, component) => {
        const { raw, normalized } = component.getScores(member.id);
        return sum + (normalized * component.weight);
      }, 0)
      / ratingComponents.reduce((sum, component) => sum + component.weight, 0)
    ),
    ratingComponents: ratingComponents.map(component => {
      const { raw, normalized } = component.getScores(member.id);
      return {
        name: component.name,
        raw,
        normalized,
      };
    }),
    isRated: ratingEligibilityTasks.every(task => {
      const completion = task.getCompletion(member.id);
      return completion >= task.required;
    }),
    ratingEligibilityTasks: ratingEligibilityTasks.map(task => {
      const completion = task.getCompletion(member.id);
      return {
        name: task.name,
        completion,
        isEligible: completion >= task.required,
      };
    }),
  };
});

const writeSheet = () => {

  const COLOR = {

    blue: '#0000ff',
    cornflower_blue: '#4a86e8',
    cyan: '#00ffff',
    green: '#00ff00',
    yellow: '#ffff00',
    orange: '#ff9900',
    red: '#ff0000',
    red_berry: '#980000',

    light_blue_1: '#6fa8dc',
    light_cornflower_blue_1: '#6d9eeb',
    light_cyan_1: '#76a5af',
    light_green_1: '#93c47d',
    light_yellow_1: '#ffd966',
    light_orange_1: '#f6b26b',
    light_red_1: '#e06666',
    light_red_berry_1: '#cc4125',

    light_blue_2: '#9fc5e8',
    light_cornflower_blue_2: '#a4c2f4',
    light_cyan_2: '#a2c4c9',
    light_green_2: '#b6d7a8',
    light_yellow_2: '#ffe599',
    light_orange_2: '#f9cb9c',
    light_red_2: '#ea9999',
    light_red_berry_2: '#dd7e6b',

    light_blue_3: '#cfe2f3',
    light_cornflower_blue_3: '#c9daf8',
    light_cyan_3: '#d0e0e3',
    light_green_3: '#d9ead3',
    light_yellow_3: '#fff2cc',
    light_orange_3: '#fce5cd',
    light_red_3: '#f4cccc',
    light_red_berry_3: '#e6b8af',

    white: '#ffffff',
    ligt_gray_3: '#f3f3f3',
    light_gray_2: '#efefef',
    light_gray_1: '#d9d9d9',
    gray: '#cccccc',
    dark_gray_1: '#b7b7b7',
    dark_gray_2: '#999999',
    dark_gray_3: '#666666',
    black: '#000000',

  } as const;

  const NUMERIC_CELL_WIDTH = 80;
  const NUM_ROWS_FROZEN = 3;
  const NUM_COLS_FROZEN = 5;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ranks');
  sheet.getDataRange().breakApart();

  // row 1: super header
  {
    ([
      ['Summary', 5],
      ['Rating Components', ratingComponents.length * 2],
      ['Rated Eligibility Tasks', ratingEligibilityTasks.length],
    ] as [string, number][])
      .reduce((column, [header, span], index) => {
        sheet.getRange(1, column, 1, span)
          .clear()
          .merge()
          .setValue(header)
          .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
          .setWrap(true)
          .setHorizontalAlignment('center')
          .setVerticalAlignment('top')
          .setBackground(
            [
              COLOR.dark_gray_1,
              COLOR.light_cyan_1,
              COLOR.light_cornflower_blue_1,
            ][index]
          )
          .setFontWeight('bold');
        return column + span;
      }, 1);
  }

  // rows 2 & 3: header
  {
    const formatRules = sheet.getConditionalFormatRules();
    while (formatRules.length > 0) {
      formatRules.pop();
    }

    let curColumn = 1;

    curColumn = ([
      ['Rank', 20],
      ['Name', 150],
      ['NSU ID', 80],
      ['Aggregate Rating', NUMERIC_CELL_WIDTH],
      ['Rated Status', NUMERIC_CELL_WIDTH],
    ] as [string, number][])
      .reduce((column, [header, width]) => {
        sheet.getRange(2, column, 2, 1)
          .clear()
          .merge()
          .setValue(header)
          .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
          .setWrap(true)
          .setHorizontalAlignment('center')
          .setVerticalAlignment('top')
          .setBackground(COLOR.gray)
          .setFontWeight('bold');
        sheet.setColumnWidth(column, width);
        sheet.getRange(NUM_ROWS_FROZEN + 1, column, memberSummaries.length, 1)
          .setBackground(COLOR.light_gray_1);
        return column + 1;
      }, curColumn);
    
    sheet.getRange(NUM_ROWS_FROZEN + 1, 5, memberSummaries.length, 1)
      .setHorizontalAlignment('center');
    
    const gradientRuleRanges = [
      sheet.getRange(NUM_ROWS_FROZEN + 1, 4, memberSummaries.length, 1)
    ];

    ([
      ['rated', COLOR.light_green_2],
      ['unrated', COLOR.light_red_2]
    ] as [string, string][])
      .forEach(([text, color]) => {
        formatRules.push(
          SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo(text)
            .setBackground(color)
            .setRanges([sheet.getRange(NUM_ROWS_FROZEN + 1, 5, memberSummaries.length, 1)])
        );
      });

    curColumn = ratingComponents.reduce((column, component) => {
      sheet.getRange(2, column, 1, 2)
        .clear()
        .merge()
        .setValue(`${component.name}\n(Weight: ${component.weight})`)
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
        .setWrap(true)
        .setHorizontalAlignment('center')
        .setVerticalAlignment('top')
        .setBackground(COLOR.light_cyan_2)
        .setFontWeight('bold');

      ['Raw', 'Normalized'].forEach((header, index) => {
        sheet.getRange(3, column + index, 1, 1)
          .clear()
          .setValue(header)
          .setHorizontalAlignment('center')
          .setVerticalAlignment('top')
          .setBackground(COLOR.light_cyan_3)
          .setFontWeight('bold');

        sheet.setColumnWidth(column + index, NUMERIC_CELL_WIDTH);
      });

      gradientRuleRanges.push(sheet.getRange(NUM_ROWS_FROZEN + 1, column + 1,
        memberSummaries.length, 1));

      return column + 2;
    }, curColumn);

    formatRules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .setGradientMaxpointWithValue(COLOR.green,
          SpreadsheetApp.InterpolationType.NUMBER, '100')
        .setGradientMidpointWithValue(COLOR.yellow,
          SpreadsheetApp.InterpolationType.NUMBER, '50')
        .setGradientMinpointWithValue(COLOR.red,
          SpreadsheetApp.InterpolationType.NUMBER, '0')
        .setRanges(gradientRuleRanges)
        .build()
    );

    curColumn = ratingEligibilityTasks.reduce((column, task) => {
      sheet.getRange(2, column, 2, 1)
        .clear()
        .merge()
        .setValue(`${task.name}\n(Target: ${task.required} / ${task.considered})`)
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
        .setWrap(true)
        .setHorizontalAlignment('center')
        .setVerticalAlignment('top')
        .setBackground(COLOR.light_cornflower_blue_2)
        .setFontWeight('bold');

      sheet.setColumnWidth(column, NUMERIC_CELL_WIDTH * 2);

      formatRules.push(
        ...([
          [1.00, COLOR.light_green_2],
          [0.66, COLOR.light_yellow_2],
          [0.33, COLOR.light_orange_2],
          [0.00, COLOR.light_red_2],
        ] as [number, string][])
          .map(([ratio, color]) => {
            return SpreadsheetApp.newConditionalFormatRule()
              .whenNumberGreaterThanOrEqualTo(Math.ceil(ratio * task.required))
              .setBackground(color)
              .setRanges([sheet.getRange(NUM_ROWS_FROZEN + 1, column,
                memberSummaries.length, 1)])
              .build();
          })
      );

      return column + 1;
    }, curColumn);

    sheet.setConditionalFormatRules(formatRules);

    sheet.getRange(1, curColumn,
      sheet.getMaxRows(), sheet.getMaxColumns() - curColumn + 1)
      .clear();
  }

  // remaining rows: data
  {
    const data = memberSummaries
      .sort((a, b) => b.aggregateRating - a.aggregateRating)
      .map((summary, index) => {
        const row = [
          index + 1,
          summary.name,
          summary.id,
          summary.aggregateRating,
          summary.isRated ? 'rated' : 'unrated',
          ...summary.ratingComponents.map(component => [
            component.raw,
            component.normalized,
          ]).flat(),
          ...summary.ratingEligibilityTasks.map(task => task.completion),
        ];

        return row;
      });

    sheet.getRange(NUM_ROWS_FROZEN + 1, 1, data.length, data[0].length)
      .setValues(data);

    sheet.getRange(NUM_ROWS_FROZEN + 1 + data.length, 1,
      sheet.getMaxRows() - (NUM_ROWS_FROZEN + data.length) + 1, sheet.getMaxColumns())
      .clear();
  }

  sheet.setFrozenRows(NUM_ROWS_FROZEN);
  sheet.setFrozenColumns(NUM_COLS_FROZEN);
};

writeSheet();

global.main = () => { };
