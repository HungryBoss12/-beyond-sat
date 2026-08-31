/**
 * Import DSAT March 2024 v2 (May 2024 Math Version C) — all 44 questions + answers.
 * Run: node scripts/import-v2-math-full.mjs
 */
import fs from "fs";
import pg from "pg";

const PAPER_TITLE = "DSAT March 2024 v2";
const SOURCE_MONTH = 3;
const SOURCE_YEAR = 2024;

function moduleTitle(base, module) {
  return `${base} · Module ${module}`;
}

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v];
      }),
  );
}

const QUESTIONS = [
  // ── Module 1 ──
  {
    module: 1,
    position: 1,
    kind: "multiple_choice",
    prompt: `| | Live north of Center St. | Live south of Center St. | Total |
| --- | --- | --- | --- |
| Less than 45 years old | 13 | 12 | 25 |
| At least 45 years old | 22 | 88 | 110 |
| Total | 35 | 100 | 135 |`,
    question_text:
      "The table summarizes members of a local organization by age and whether they live north or south of Center St. If a member of the organization is selected at random, what is the probability that the selected member is at least 45 years old?",
    choices: [
      { id: "A", text: "30/135" },
      { id: "B", text: "35/135" },
      { id: "C", text: "100/135" },
      { id: "D", text: "110/135" },
    ],
    correct_choice_id: "D",
  },
  {
    module: 1,
    position: 2,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "A number x is at least twice the value of a number y. If the value of y is 65, which inequality represents the possible values of x?",
    choices: [
      { id: "A", text: "x ≥ 63" },
      { id: "B", text: "x ≥ 67" },
      { id: "C", text: "x ≥ 130" },
      { id: "D", text: "x ≥ 132" },
    ],
    correct_choice_id: "C",
  },
  {
    module: 1,
    position: 3,
    kind: "multiple_choice",
    prompt: "$9m = 8(n + p)$",
    question_text:
      "The given equation relates the positive numbers m, n, and p. Which equation correctly gives m in terms of n and p?",
    choices: [
      { id: "A", text: "$m = \\frac{8(n+p)}{9}$" },
      { id: "B", text: "$m = 8(n+p)$" },
      { id: "C", text: "$m = 8(n+p) - 9$" },
      { id: "D", text: "$m = 8 - n - p - 9$" },
    ],
    correct_choice_id: "A",
  },
  {
    module: 1,
    position: 4,
    kind: "multiple_choice",
    prompt: "[FIGURE NEEDED — add an image URL for this question]",
    question_text: "In the right triangle shown, what is the value of a?",
    choices: [
      { id: "A", text: "36" },
      { id: "B", text: "54" },
      { id: "C", text: "90" },
      { id: "D", text: "126" },
    ],
    correct_choice_id: "B",
  },
  {
    module: 1,
    position: 5,
    kind: "multiple_choice",
    prompt: null,
    question_text: "If $4x - 28 = -12$, what is the value of $x - 7$?",
    choices: [
      { id: "A", text: "−25" },
      { id: "B", text: "−12" },
      { id: "C", text: "−4" },
      { id: "D", text: "−3" },
    ],
    correct_choice_id: "D",
  },
  {
    module: 1,
    position: 6,
    kind: "multiple_choice",
    prompt: "[FIGURE NEEDED — add an image URL for this question]",
    question_text: "In the triangle shown, what is the value of $\\sin y°$?",
    choices: [
      { id: "A", text: "$\\frac{5}{37}$" },
      { id: "B", text: "$\\frac{32}{37}$" },
      { id: "C", text: "$\\frac{37}{32}$" },
      { id: "D", text: "$\\frac{37}{5}$" },
    ],
    correct_choice_id: "B",
  },
  {
    module: 1,
    position: 7,
    kind: "grid_in",
    prompt: "[FIGURE NEEDED — add an image URL for this question]",
    question_text:
      "A bank account was opened with an initial deposit. Over the next several months, regular deposits were made into this account, and there were no withdrawals made during this time. The graph of the function f shown, where $y = f(x)$, estimates the account balance, in dollars, in this bank account x months since the initial deposit. To the nearest whole dollar, what is the amount of the initial deposit estimated by the graph?",
    choices: [],
    correct_grid_answers: ["20"],
  },
  {
    module: 1,
    position: 8,
    kind: "grid_in",
    prompt: null,
    question_text:
      "A line segment that has a length of 118 centimeters (cm) is divided into three parts. One part is 48 cm long. The other two parts have lengths that are equal to each other. What is the length, in cm, of one of the other two parts of equal length?",
    choices: [],
    correct_grid_answers: ["35"],
  },
  {
    module: 1,
    position: 9,
    kind: "multiple_choice",
    prompt: "[FIGURE NEEDED — add an image URL for this question]",
    question_text:
      "Data sets X and Y are summarized in the tables shown, where a, b, and c are positive, consecutive integers and $a < b < c$. Which statement comparing the means of the data sets is true?",
    choices: [
      { id: "A", text: "The mean of data set X is $\\frac{2}{19}$ less than the mean of data set Y." },
      { id: "B", text: "The mean of data set X is $\\frac{2}{19}$ greater than the mean of data set Y." },
      { id: "C", text: "The mean of data set Y is 100 times the mean of data set X." },
      { id: "D", text: "The means of the two data sets are equal." },
    ],
    correct_choice_id: "A",
  },
  {
    module: 1,
    position: 10,
    kind: "multiple_choice",
    prompt: "$5x + 5y = 150$\n$x + y = 2x$",
    question_text:
      "If the solution to the given system of equations is $(x, y)$, which of the following equations is true?",
    choices: [
      { id: "A", text: "$2x = 5$" },
      { id: "B", text: "$2x = 30$" },
      { id: "C", text: "$2x = 145$" },
      { id: "D", text: "$2x = 150$" },
    ],
    correct_choice_id: "B",
  },
  {
    module: 1,
    position: 11,
    kind: "grid_in",
    prompt: "$f(x) = 3(x - 2)(x - 6)(x - 9)$",
    question_text:
      "If the given function f is graphed in the xy-plane, where $y = f(x)$, what is the x-coordinate of an x-intercept of the graph?",
    choices: [],
    correct_grid_answers: ["2", "6", "9"],
  },
  {
    module: 1,
    position: 12,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "Scientists collected fallen acorns that each housed a colony of the ant species P. ohioensis and analyzed each colony's structure. For any of these colonies, if the colony has x worker ants, the equation $y = 0.67x + 2.6$, where $20 \\leq x \\leq 110$, gives the predicted number of larvae, y, in the colony. If one of these colonies has 57 worker ants, which of the following is closest to the predicted number of larvae in the colony?",
    choices: [
      { id: "A", text: "186" },
      { id: "B", text: "81" },
      { id: "C", text: "60" },
      { id: "D", text: "41" },
    ],
    correct_choice_id: "D",
  },
  {
    module: 1,
    position: 13,
    kind: "grid_in",
    prompt: "$9x + 5y = 19$\n$-9x - 3y = 7$",
    question_text: "The solution to the given system of equations is $(x, y)$. What is the value of $2y$?",
    choices: [],
    correct_grid_answers: ["26"],
  },
  {
    module: 1,
    position: 14,
    kind: "multiple_choice",
    prompt: "$y = x^2 + 18x + 8$\n$y = x + 8$",
    question_text:
      "The graphs of the equations in the given system intersect at the point $(x, y)$ in the xy-plane. What is a possible value of x?",
    choices: [
      { id: "A", text: "14" },
      { id: "B", text: "10" },
      { id: "C", text: "−14" },
      { id: "D", text: "−17" },
    ],
    correct_choice_id: "D",
  },
  {
    module: 1,
    position: 15,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "A circle in the xy-plane has its center at $(-4, 2)$ and the point $(-8, 5)$ lies on the circle. Which equation represents this circle?",
    choices: [
      { id: "A", text: "$(x - 4)^2 + (y + 2)^2 = 5$" },
      { id: "B", text: "$(x + 4)^2 + (y - 2)^2 = 5$" },
      { id: "C", text: "$(x - 4)^2 + (y + 2)^2 = 25$" },
      { id: "D", text: "$(x + 4)^2 + (y - 2)^2 = 25$" },
    ],
    correct_choice_id: "D",
  },
  {
    module: 1,
    position: 16,
    kind: "multiple_choice",
    prompt: "[FIGURE NEEDED — add an image URL for this question]",
    question_text:
      "The graph models the number of online newsletter subscribers at the end of every six-month period, where x is the number of six-month periods since the end of January 1993 and $0 \\leq x \\leq 4$. Which statement is the best interpretation of the point $(1, 750)$ in this context?",
    choices: [
      {
        id: "A",
        text: "The estimated number of online newsletter subscribers at the end of the first six-month period was 750.",
      },
      {
        id: "B",
        text: "The estimated number of online newsletter subscribers increased every six months by 750 subscribers.",
      },
      {
        id: "C",
        text: "The estimated number of online newsletter subscribers at the end of January 1993 was 750.",
      },
      {
        id: "D",
        text: "The estimated number of online newsletter subscribers at the end of the first month was 750.",
      },
    ],
    correct_choice_id: "A",
  },
  {
    module: 1,
    position: 17,
    kind: "grid_in",
    prompt: "[FIGURE NEEDED — add an image URL for this question]",
    question_text:
      "The right square pyramid shown has a height of 9 centimeters (cm). The length, in cm, of one edge of the pyramid's base is $\\frac{13}{3}$ times the height of the pyramid. What is the volume, in cm³, of the pyramid?",
    choices: [],
    correct_grid_answers: ["4563"],
  },
  {
    module: 1,
    position: 18,
    kind: "grid_in",
    prompt: null,
    question_text:
      "In the xy-plane, line p has a slope of $\\frac{5}{3}$ and an x-intercept of $(9, 0)$. What is the y-coordinate of the y-intercept of line p?",
    choices: [],
    correct_grid_answers: ["-15"],
  },
  {
    module: 1,
    position: 19,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "In 2018, approximately 40,000 kilowatts of solar power capacity was newly installed in a certain area in the United States. In 2019, the amount of newly installed solar power capacity in this area increased by 11% from the amount of newly installed solar power capacity in 2018. If the amount of newly installed solar power capacity continues to increase each year by 11% of the previous year's newly installed solar power capacity, which of the following types of functions best describes how the amount of newly installed solar power capacity changes over time?",
    choices: [
      { id: "A", text: "Increasing linear" },
      { id: "B", text: "Decreasing linear" },
      { id: "C", text: "Increasing exponential" },
      { id: "D", text: "Decreasing exponential" },
    ],
    correct_choice_id: "C",
  },
  {
    module: 1,
    position: 20,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "An object is launched into the air from ground level. According to a quadratic model, 3.8 seconds after the object is launched, it reaches its maximum height of 231.04 feet above ground level. Which equation represents this model, where $f(t)$ is the object's height, in feet, above ground level t seconds after it was launched?",
    choices: [
      { id: "A", text: "$f(t) = -16(t - 3.8)^2 + 231.04$" },
      { id: "B", text: "$f(t) = 16(t + 3.8)^2 + 231.04$" },
      { id: "C", text: "$f(t) = -16(t + 3.8)^2 + 231.04$" },
      { id: "D", text: "$f(t) = 16(t - 3.8)^2 + 231.04$" },
    ],
    correct_choice_id: "A",
  },
  {
    module: 1,
    position: 21,
    kind: "multiple_choice",
    prompt: "$7x - 56y = 14$",
    question_text:
      "One of the two equations in a system of linear equations is given. The system has no solution. Which equation could be the second equation in this system?",
    choices: [
      { id: "A", text: "$\\frac{1}{2}x - 4y = 1$" },
      { id: "B", text: "$x - 8y = 2$" },
      { id: "C", text: "$\\frac{1}{2}x - 4y = 0$" },
      { id: "D", text: "$x - 14y = 0$" },
    ],
    correct_choice_id: "C",
  },
  {
    module: 1,
    position: 22,
    kind: "multiple_choice",
    prompt: "$f(x) = 7{,}000(1.003)^{2x}$",
    question_text:
      "The given function f models the balance of a bank account, in dollars, x years after it is opened. Which statement is the best interpretation of $(1.003)^{2x}$?",
    choices: [
      { id: "A", text: "Every 6 months, the balance increases by about $3." },
      { id: "B", text: "Every 2 years, the balance increases by about $3." },
      {
        id: "C",
        text: "At the end of every 6-month interval, the balance increases by about 0.3% of the balance at the beginning of the 6-month interval.",
      },
      {
        id: "D",
        text: "At the end of every 2-year interval, the balance increases by about 0.3% of the balance at the beginning of the 2-year interval.",
      },
    ],
    correct_choice_id: "D",
  },

  // ── Module 2 ──
  {
    module: 2,
    position: 1,
    kind: "multiple_choice",
    prompt: "[FIGURE NEEDED — add an image URL for this question]",
    question_text:
      "Line j is shown in the xy-plane. Line k (not shown) is parallel to line j and passes through the point $(0, 5)$. Which equation defines line k?",
    choices: [
      { id: "A", text: "$y = \\frac{2}{3}x + 5$" },
      { id: "B", text: "$y = \\frac{2}{3}x - 5$" },
      { id: "C", text: "$y = \\frac{3}{2}x + 5$" },
      { id: "D", text: "$y = \\frac{3}{2}x - 5$" },
    ],
    correct_choice_id: "A",
  },
  {
    module: 2,
    position: 2,
    kind: "multiple_choice",
    prompt: "[FIGURE NEEDED — add an image URL for this question]",
    question_text: "What is an equation of the graph shown?",
    choices: [
      { id: "A", text: "$y = x + 12$" },
      { id: "B", text: "$y = -x + 12$" },
      { id: "C", text: "$y = 2x + 12$" },
      { id: "D", text: "$y = -2x + 12$" },
    ],
    correct_choice_id: "B",
  },
  {
    module: 2,
    position: 3,
    kind: "multiple_choice",
    prompt: "[FIGURE NEEDED — add an image URL for this question]",
    question_text:
      "In the figure shown, the length of $\\overline{AB}$ is 66. Which statement provides sufficient information to prove that triangle ABC is isosceles?",
    choices: [
      { id: "A", text: "The length of $\\overline{BC}$ is 66." },
      { id: "B", text: "The length of $\\overline{AC}$ is 33." },
      { id: "C", text: "The measure of angle A is 70°." },
      { id: "D", text: "The sum of the measures of angles A, B, and C is 180°." },
    ],
    correct_choice_id: "A",
  },
  {
    module: 2,
    position: 4,
    kind: "multiple_choice",
    prompt: null,
    question_text: "If 310% of n is 62, what is the value of n?",
    choices: [
      { id: "A", text: "19,220" },
      { id: "B", text: "1,922" },
      { id: "C", text: "500" },
      { id: "D", text: "20" },
    ],
    correct_choice_id: "D",
  },
  {
    module: 2,
    position: 5,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "For the linear function f, the graph of $y = f(x)$ in the xy-plane has a slope of 0 and passes through the point $(0, 25)$. Which equation defines f?",
    choices: [
      { id: "A", text: "$f(x) = x + 25$" },
      { id: "B", text: "$f(x) = 25x$" },
      { id: "C", text: "$f(x) = 0$" },
      { id: "D", text: "$f(x) = 25$" },
    ],
    correct_choice_id: "D",
  },
  {
    module: 2,
    position: 6,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "The amount of money owed on a certain type of loan has two components: the principal balance of the loan and the amount of interest accrued on the loan. For a loan of this type, each payment was $298.00 and there were 60 payments total. Part of each payment was applied to the principal balance of the loan, and the rest was applied to the amount of interest accrued on the loan. The amount of the 1st payment that was applied to the principal balance was $220.93. For each additional payment, the amount that was applied to the principal balance was approximately 0.5% greater than the amount that was applied to the principal balance for the previous payment. Which function best approximates the amount of the xth payment, in dollars, that was applied to the amount of interest accrued, where $x \\leq 60$?",
    choices: [
      { id: "A", text: "$f(x) = 298.00 - 220.93(1.005)^{x-1}$" },
      { id: "B", text: "$f(x) = 298.00 - 220.93(1.005)^{x}$" },
      { id: "C", text: "$f(x) = 298.00 - 220.93(0.995)^{x-1}$" },
      { id: "D", text: "$f(x) = 298.00 - 220.93(0.995)^{x}$" },
    ],
    correct_choice_id: "A",
  },
  {
    module: 2,
    position: 7,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "If $a = 4k + 7r$ and $b = 9k - 11r + 5$, which expression is equivalent to $a - b$?",
    choices: [
      { id: "A", text: "$-5k + 18r + 5$" },
      { id: "B", text: "$-5k + 18r - 5$" },
      { id: "C", text: "$-5k - 4r - 5$" },
      { id: "D", text: "$-5k - 4r + 5$" },
    ],
    correct_choice_id: "B",
  },
  {
    module: 2,
    position: 8,
    kind: "multiple_choice",
    prompt: "$16(x + 4) = 2(x + c) + 14x$",
    question_text:
      "In the given equation, c is a constant. The equation has infinitely many solutions. What is the value of c?",
    choices: [
      { id: "A", text: "4" },
      { id: "B", text: "8" },
      { id: "C", text: "32" },
      { id: "D", text: "64" },
    ],
    correct_choice_id: "C",
  },
  {
    module: 2,
    position: 9,
    kind: "multiple_choice",
    prompt: null,
    question_text: "Which quadratic equation has exactly one distinct real solution?",
    choices: [
      { id: "A", text: "$x^2 - 18 = 0$" },
      { id: "B", text: "$x^2 + 18 = 0$" },
      { id: "C", text: "$x^2 - 18x + 72 = 0$" },
      { id: "D", text: "$x^2 - 18x + 81 = 0$" },
    ],
    correct_choice_id: "D",
  },
  {
    module: 2,
    position: 10,
    kind: "multiple_choice",
    prompt: "$p(x) = 2x^4 + 9$",
    question_text: "What is the y-intercept of the graph of $y = p(x)$ in the xy-plane?",
    choices: [
      { id: "A", text: "$(0, 18)$" },
      { id: "B", text: "$(0, 27)$" },
      { id: "C", text: "$(0, 11)$" },
      { id: "D", text: "$(0, 9)$" },
    ],
    correct_choice_id: "D",
  },
  {
    module: 2,
    position: 11,
    kind: "grid_in",
    prompt: "[FIGURE NEEDED — add an image URL for this question]",
    question_text:
      "During an experiment, the temperature, in degrees Celsius (°C), of a mixture was recorded to the nearest integer at certain times. The scatterplot shows the recorded temperature y, in °C, of the mixture x hours after the start of the experiment. What was the average rate of change of the recorded temperature of the mixture over time, in °C per hour, from $x = 1$ to $x = 3$?",
    choices: [],
    correct_grid_answers: ["2"],
  },
  {
    module: 2,
    position: 12,
    kind: "multiple_choice",
    prompt: "Data set A: 24, 34, 44, 54, 64",
    question_text:
      "Data set A, which consists of the 5 values shown, has a mean of 44 and a standard deviation of approximately 14.10. Data set B consists of the 5 values from data set A and one additional value, k. For which of the following values of k will the standard deviation of data set B be less than the standard deviation of data set A?",
    choices: [
      { id: "A", text: "14" },
      { id: "B", text: "49" },
      { id: "C", text: "74" },
      {
        id: "D",
        text: "There is no value of k such that the standard deviation of data set B will be less than the standard deviation of data set A.",
      },
    ],
    correct_choice_id: "B",
  },
  {
    module: 2,
    position: 13,
    kind: "grid_in",
    prompt: null,
    question_text:
      "A right square pyramid has a surface area of 75,264 square inches, which includes a base area of 36,864 square inches. What is the slant height, in inches, of this pyramid?",
    choices: [],
    correct_grid_answers: ["100"],
  },
  {
    module: 2,
    position: 14,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "At a depth of h meters below the surface, the estimated total pressure $P_1$, in kilopascals (kPa), a diver experienced is given by $P_1 = 10h + 101$, which is a combination of estimated water pressure and estimated atmospheric pressure. After maintaining a certain depth, the diver descended d additional meters. The estimated total pressure $P_2$, in kPa, the diver experienced after descending these d additional meters is given by $P_2 = 10d + 311$. Which of the following is the best interpretation of 311 in this context?",
    choices: [
      { id: "A", text: "The estimated total pressure, in kPa, the diver experienced at a depth of d meters" },
      {
        id: "B",
        text: "The estimated increase in the total pressure, in kPa, the diver experienced for each increase in the depth by 1 meter",
      },
      {
        id: "C",
        text: "The estimated increase in the total pressure, in kPa, the diver experienced for each increase in the depth by d meters",
      },
      {
        id: "D",
        text: "The estimated total pressure, in kPa, the diver experienced when the diver began to descend d additional meters",
      },
    ],
    correct_choice_id: "D",
  },
  {
    module: 2,
    position: 15,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "A company developed a plan to set the selling price of a product. The company determined that for a selling price of $150.00, zero products would be sold. For each $2.50 decrease in the selling price, the number of products sold would increase by one. For a revenue of exactly $2,187.50, which of the following could be the number of products sold? (revenue = price × number of products sold)",
    choices: [
      { id: "A", text: "25" },
      { id: "B", text: "30" },
      { id: "C", text: "815" },
      { id: "D", text: "2,250" },
    ],
    correct_choice_id: "A",
  },
  {
    module: 2,
    position: 16,
    kind: "multiple_choice",
    prompt: "$56(x^3 + 64)(x^4 - 81) = 0$",
    question_text: "How many distinct real solutions does the given equation have?",
    choices: [
      { id: "A", text: "Exactly two" },
      { id: "B", text: "Exactly three" },
      { id: "C", text: "Exactly five" },
      { id: "D", text: "Exactly seven" },
    ],
    correct_choice_id: "B",
  },
  {
    module: 2,
    position: 17,
    kind: "grid_in",
    prompt: null,
    question_text:
      "As the size of a firework's shell increases, the height above the ground when the firework bursts increases. For a firework to burst 1,075 feet above the ground, a firework's shell in the shape of a sphere with a volume of 514.23 cubic inches could be used. To the nearest whole number, what is the volume of this firework's shell in cubic centimeters? (1 inch = 2.54 centimeters)",
    choices: [],
    correct_grid_answers: ["8427"],
  },
  {
    module: 2,
    position: 18,
    kind: "grid_in",
    prompt: "$-9x(x + 9) = 90$",
    question_text:
      "One solution to the given equation can be written as $x = \\frac{-s + \\sqrt{t}}{2}$, where s and t are positive integers. What is the value of $st$?",
    choices: [],
    correct_grid_answers: ["369"],
  },
  {
    module: 2,
    position: 19,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "Which of the following expressions has a factor of $x + 2b$, where b is a positive integer constant?",
    choices: [
      { id: "A", text: "$3x^2 + 9x + 18b$" },
      { id: "B", text: "$3x^2 + 24x + 18b$" },
      { id: "C", text: "$3x^2 + 30x + 18b$" },
      { id: "D", text: "$3x^2 + 39x + 18b$" },
    ],
    correct_choice_id: "D",
  },
  {
    module: 2,
    position: 20,
    kind: "grid_in",
    prompt: null,
    question_text:
      "Right rectangular prism X is similar to right rectangular prism Y. The surface area of right rectangular prism X is 52 square centimeters (cm²), and the surface area of right rectangular prism Y is 3,328 cm². The volume of right rectangular prism X is 10.5 cubic centimeters (cm³). What is the volume, in cm³, of right rectangular prism Y?",
    choices: [],
    correct_grid_answers: ["5376"],
  },
  {
    module: 2,
    position: 21,
    kind: "grid_in",
    prompt: "$38z^{18} + bz^9 + 30$",
    question_text:
      "In the given expression, b is a positive integer. If $qz^9 + r$ is a factor of the expression, where q and r are positive integers, what is the greatest possible value of b?",
    choices: [],
    correct_grid_answers: ["1141"],
  },
  {
    module: 2,
    position: 22,
    kind: "multiple_choice",
    prompt: null,
    question_text:
      "The cost of renting a piece of equipment is $46n for the first day and $23n for each additional day, where n is a positive integer. Which of the following functions gives the cost $C(x)$, in dollars, of renting this equipment for x days, where x is a positive integer?",
    choices: [
      { id: "A", text: "$C(x) = 23nx + 23n$" },
      { id: "B", text: "$C(x) = 23nx + 46n$" },
      { id: "C", text: "$C(x) = 46nx + 23n$" },
      { id: "D", text: "$C(x) = 46nx - 23n$" },
    ],
    correct_choice_id: "A",
  },
];

function buildPayload(q) {
  const kind = q.kind === "grid_in" ? "grid_in" : "multiple_choice";
  return {
    section: "math",
    skill: "Algebra",
    difficulty: "C",
    kind,
    prompt: q.prompt || null,
    question_text: q.question_text,
    choices: kind === "multiple_choice" ? q.choices : [],
    correct_choice_id: kind === "multiple_choice" ? q.correct_choice_id : null,
    correct_grid_answers: kind === "grid_in" ? q.correct_grid_answers : null,
    explanation: null,
    image_url: null,
    source_month: SOURCE_MONTH,
    source_year: SOURCE_YEAR,
    module: q.module,
    position: q.position,
  };
}

async function main() {
  console.log(`Importing ${QUESTIONS.length} questions for "${PAPER_TITLE}"`);

  const env = loadEnv();
  const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows: existing } = await client.query(
    `select id from public.tests where title like $1`,
    [`${PAPER_TITLE}%`],
  );
  for (const { id } of existing) {
    const { rows: links } = await client.query(
      `select question_id from public.test_questions where test_id = $1`,
      [id],
    );
    await client.query(`delete from public.test_questions where test_id = $1`, [id]);
    await client.query(`delete from public.tests where id = $1`, [id]);
    for (const { question_id } of links) {
      await client.query(`delete from public.questions where id = $1`, [question_id]);
    }
  }
  if (existing.length) console.log(`Removed ${existing.length} prior test module(s)`);

  const byModule = { 1: [], 2: [] };
  let withAnswers = 0;

  for (const q of QUESTIONS) {
    const payload = buildPayload(q);
    const hasAnswer =
      payload.correct_choice_id ||
      (payload.correct_grid_answers && payload.correct_grid_answers.length);
    if (hasAnswer) withAnswers++;

    const { rows } = await client.query(
      `insert into public.questions (
        section, skill, difficulty, kind, prompt, question_text, choices,
        correct_choice_id, correct_grid_answers, explanation, image_url,
        source_month, source_year, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14)
      returning id`,
      [
        payload.section,
        payload.skill,
        payload.difficulty,
        payload.kind,
        payload.prompt,
        payload.question_text,
        JSON.stringify(payload.choices),
        payload.correct_choice_id,
        payload.correct_grid_answers,
        payload.explanation,
        payload.image_url,
        payload.source_month,
        payload.source_year,
        null,
      ],
    );
    byModule[payload.module].push({ id: rows[0].id, position: payload.position });
  }

  for (const module of [1, 2]) {
    const items = byModule[module].sort((a, b) => a.position - b.position);
    const title = moduleTitle(PAPER_TITLE, module);
    const { rows: testRows } = await client.query(
      `insert into public.tests (title, section, module, difficulty, source_month, source_year, created_by)
       values ($1,'math',$2,'C',$3,$4,null) returning id`,
      [title, module, SOURCE_MONTH, SOURCE_YEAR],
    );
    for (const item of items) {
      await client.query(
        `insert into public.test_questions (test_id, question_id, position) values ($1,$2,$3)`,
        [testRows[0].id, item.id, item.position],
      );
    }
    console.log(`Created "${title}" — ${items.length} questions`);
  }

  await client.end();
  console.log(`Done: ${QUESTIONS.length} questions (${withAnswers} with answer keys)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
