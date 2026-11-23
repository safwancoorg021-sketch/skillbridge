require("dotenv").config();
const mongoose = require("mongoose");
const Course = require("../models/Course");
const CourseQuiz = require("../models/CourseQuiz");

const question = (prompt, choices, correctAnswer) => ({ prompt, choices, correctAnswer });
const answerPositions = [2, 0, 3, 1, 2, 3, 0, 1, 3, 2];

function mixAnswerPositions(questions) {
  return questions.map((item, index) => {
    const correctAnswer = item.correctAnswer;
    const correctChoice = item.choices[correctAnswer];
    const choices = item.choices.filter((_, choiceIndex) => choiceIndex !== correctAnswer);
    const newCorrectAnswer = answerPositions[index % answerPositions.length];
    choices.splice(newCorrectAnswer, 0, correctChoice);
    return { ...item, choices, correctAnswer: newCorrectAnswer };
  });
}

const quizTemplates = [
  {
    matches: ["javascript fundamentals", "javascript fundamentals ", "javascript"],
    title: "JavaScript Fundamentals Assessment",
    questions: [
      question("What is JavaScript primarily used for in a web page?", ["Adding behavior and interactivity", "Defining the page structure", "Styling the page layout", "Storing database backups"], 0),
      question("Which statement about a variable declared with const is correct?", ["Its binding cannot be reassigned", "It is automatically global", "It can only store numbers", "It disappears after one line"], 0),
      question("Which syntax creates an array in JavaScript?", ["[\"red\", \"blue\"]", "{\"red\", \"blue\"}", "(\"red\", \"blue\")", "<\"red\", \"blue\">"], 0),
      question("What does document.getElementById(\"notice\") do?", ["Finds the page element whose id is notice", "Creates a new HTML document", "Changes every element's class", "Sends a request to a server"], 0),
      question("How can code respond when a user clicks a button?", ["Register a click event listener", "Declare a CSS variable", "Add an item to local scope", "Use an arithmetic operator"], 0),
      question("What does Array.prototype.map() normally return?", ["A new array containing transformed values", "The first item in the array", "A number of matching items", "The original array's length"], 0),
      question("What is a closure in JavaScript?", ["A function that retains access to variables from its outer scope", "A loop that always runs once", "A way to close the browser tab", "An object that cannot be changed"], 0),
      question("What does a Promise represent?", ["The eventual result of an asynchronous operation", "A guarantee that code has no errors", "A browser event handler", "A JavaScript array of callbacks"], 0),
      question("Where is await commonly used when waiting for a Promise?", ["Inside an async function", "Inside a CSS selector", "Only in an HTML attribute", "Inside a variable name"], 0),
      question("When is a for loop especially useful?", ["When repeating work for a sequence or known number of steps", "When styling an element", "When creating an HTML heading", "When defining a database schema"], 0),
    ],
  },
  {
    matches: ["html fundamentals", "html"],
    title: "HTML Fundamentals Assessment",
    questions: [
      question("What does HTML describe?", ["The structure and meaning of web page content", "The visual styling rules only", "The server's database tables", "The browser's network connection"], 0),
      question("Which element identifies the primary content of a page?", ["<main>", "<aside>", "<style>", "<script>"], 0),
      question("Which list element is best for steps that must be followed in order?", ["<ol>", "<ul>", "<dl>", "<menuitem>"], 0),
      question("What is the purpose of <!doctype html>?", ["It tells the browser to use modern HTML standards mode", "It adds a visible title to the page", "It links the CSS file", "It creates the page's navigation"], 0),
      question("Which attribute specifies where an anchor link should go?", ["href", "alt", "name", "for"], 0),
      question("What should useful alt text on an image do?", ["Describe the image's relevant information", "Repeat the image file name", "Set the image's width", "Open the image in a new tab"], 0),
      question("How should a form label be associated with an input?", ["Match the label's for value to the input's id", "Give both elements the same class only", "Put the input inside a heading", "Set the label's href to the input"], 0),
      question("Which input type is appropriate for collecting an email address?", ["type=\"email\"", "type=\"image\"", "type=\"range\"", "type=\"color\""], 0),
      question("What does the name attribute on a form control provide?", ["The field key used when form data is submitted", "The visible label text", "The page's heading level", "The input's CSS class"], 0),
      question("What does the required attribute communicate on a form input?", ["A value must be supplied before normal form submission", "The value is hidden from the user", "The form should submit immediately", "The field is read-only"], 0),
    ],
  },
  {
    matches: ["css fundamentals", "css"],
    title: "CSS Fundamentals Assessment",
    questions: [
      question("Which selector targets elements with class card?", [".card", "#card", "card()", "@card"], 0),
      question("What is the box model order from the content outward?", ["Content, padding, border, margin", "Margin, content, border, padding", "Padding, margin, content, border", "Content, margin, padding, border"], 0),
      question("Where does padding add space?", ["Between an element's content and its border", "Outside the element's margin", "Between sibling elements only", "Before the HTML document"], 0),
      question("What does margin control?", ["Space outside an element's border", "Space between text and its background only", "The font size", "The number of grid columns"], 0),
      question("What does box-sizing: border-box make easier?", ["Keeping declared width inclusive of padding and border", "Making every element a flex container", "Centering every element automatically", "Removing all margins"], 0),
      question("What is CSS Grid designed to arrange?", ["Items in rows and columns", "Only text decorations", "JavaScript events", "Form submission data"], 0),
      question("In a flex container, what does justify-content generally control?", ["Distribution along the main axis", "Font weight", "The element's HTML meaning", "The page's media type"], 0),
      question("What is a media query used for in responsive design?", ["Applying styles when conditions such as viewport width match", "Loading a video into a page", "Selecting an element by id", "Sending CSS to a database"], 0),
      question("Why should a keyboard focus style remain visible?", ["It helps keyboard users see which control is focused", "It improves image compression", "It changes the browser's zoom level", "It prevents a form from submitting"], 0),
      question("Which HTML element commonly links an external CSS file?", ["<link rel=\"stylesheet\" href=\"styles.css\">", "<img src=\"styles.css\">", "<a type=\"css\">", "<meta class=\"stylesheet\">"], 0),
    ],
  },
];

async function seedCourseQuizzes() {
  await mongoose.connect(process.env.MONGODB_URI);
  const courses = await Course.find({}).select("title").lean();
  const unmatched = [];
  let created = 0;
  let alreadyHadQuiz = 0;

  for (const course of courses) {
    const normalizedTitle = course.title.trim().toLowerCase();
    const template = quizTemplates.find((item) => item.matches.includes(normalizedTitle));
    if (!template) {
      unmatched.push(course.title);
      continue;
    }
    const result = await CourseQuiz.updateOne(
      { course: course._id },
      { $setOnInsert: { course: course._id, title: template.title, passPercentage: 70, questions: mixAnswerPositions(template.questions) } },
      { upsert: true, runValidators: true }
    );
    if (result.upsertedCount) created += 1;
    else alreadyHadQuiz += 1;
  }

  console.log(`Created ${created} course quiz(es); left ${alreadyHadQuiz} existing quiz(es) unchanged.`);
  if (unmatched.length) console.log(`No quiz template matched: ${unmatched.join(", ")}`);
}

seedCourseQuizzes()
  .catch((error) => {
    console.error("Unable to add course quizzes:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
