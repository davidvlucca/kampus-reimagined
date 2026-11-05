// Conteúdo da visita virtual. Fica em código (não na BD) porque é igual para todos
// os alunos e só muda com uma nova versão da app.
// Cenários e guias: ilustrações SVG feitas para esta versão (client/public/tour/).
// As imagens de 2023 vinham do Google, sem licença, e saíram do projeto.

export const CAMPUS_NAME = "Kampus Lisbon"; // Campus fictício

export type GuideId = "program-manager" | "lead-teacher" | "teaching-assistant" | "career-coach";

/**
 * Expressão do guia numa fala. "smile" é a imagem base; as outras são variantes geradas
 * por scripts/guide-moods.ts. Enquanto o texto se escreve, a boca alterna com "talk".
 */
export const GUIDE_MOODS = ["smile", "wink", "curious"] as const;
export type GuideMood = (typeof GUIDE_MOODS)[number];
export type GuideFace = GuideMood | "talk";

/** Caminho da imagem do guia com uma expressão. */
export function guideImage(guide: GuideId, face: GuideFace = "smile"): string {
  return face === "smile" ? `/tour/guide-${guide}.svg` : `/tour/guide-${guide}-${face}.svg`;
}

export interface TourGuide {
  id: GuideId;
  /** Tem de bater com `staff_title` de um staff do seed. */
  title: string;
  image: string;
}

export const GUIDES: Record<GuideId, TourGuide> = {
  "program-manager": { id: "program-manager", title: "Program Manager", image: guideImage("program-manager") },
  "lead-teacher": { id: "lead-teacher", title: "Lead Teacher", image: guideImage("lead-teacher") },
  "teaching-assistant": { id: "teaching-assistant", title: "Teaching Assistant", image: guideImage("teaching-assistant") },
  "career-coach": { id: "career-coach", title: "Career Coach", image: guideImage("career-coach") },
};

/** Pergunta que o aluno pode fazer ao guia numa paragem (como as escolhas de um visual novel). */
export interface TourQuestion {
  id: string;
  label: string;
  answer: string;
  mood: GuideMood;
}

export interface TourStop {
  id: string;
  name: string;
  scene: string;
  /** Descrição do cenário para leitores de ecrã. */
  sceneAlt: string;
  guide: GuideId;
  text: string;
  mood: GuideMood;
  questions: readonly TourQuestion[];
}

export const TOUR_STOPS: readonly TourStop[] = [
  {
    id: "entrance",
    name: "Entrance and reception",
    scene: "/tour/scene-reception.svg",
    sceneAlt: "Illustrated building entrance with a glass door, a reception desk inside and a row of lockers along the wall.",
    guide: "program-manager",
    text: "Hi, I'm Marta, the Program Manager. On day 1, arrive at 8:45 and go straight to the reception desk. You'll get your student card with your ID, then Tiago, our Campus Manager, gives you a locker key.",
    mood: "smile",
    questions: [
      {
        id: "arrive-late",
        label: "What if I'm late on the first day?",
        answer: "Come in anyway and tell reception. Doors open at 8:30 and the first class starts at 9:00, so you have time. Lisbon traffic has seen worse. Just don't skip the card pick-up.",
        mood: "wink",
      },
      {
        id: "who-to-ask",
        label: "Who do I ask if something is wrong?",
        answer: "Tiago for keys, Wi-Fi and the building. Me for anything about the program, your schedule or just feeling lost. We both sit near reception, and the Contacts page has our emails.",
        mood: "smile",
      },
      {
        id: "get-there",
        label: "How do I get here without a car?",
        answer: "We're in the Baixa, about five minutes on foot from Praça do Comércio. Metro, train and buses all stop nearby. If you need step-free access, tell me before day 1 and we'll sort it out.",
        mood: "curious",
      },
    ],
  },
  {
    id: "web-dev",
    name: "Web Dev classroom",
    scene: "/tour/scene-web-dev.svg",
    sceneAlt: "Illustrated classroom with rows of desks, laptops, a large screen showing code and a whiteboard with a weekly plan.",
    guide: "lead-teacher",
    text: "I'm Rui, Lead Teacher. We start at 9:00 with a short stand-up, then a lecture, then labs. Daily exercises build up to a weekly project. You'll pair up a lot, so bring your laptop and charger.",
    mood: "smile",
    questions: [
      {
        id: "no-coding",
        label: "I've never written code. Will I keep up?",
        answer: "Most people here started from zero, and the first weeks are built for that. You will feel slow for a bit. That is normal, and it passes faster than you expect.",
        mood: "smile",
      },
      {
        id: "pairing",
        label: "What is pair programming, really?",
        answer: "Two people, one problem. One types, the other thinks out loud, then you swap every 15 minutes or so. It feels awkward on day 1 and useful by Friday.",
        mood: "curious",
      },
      {
        id: "laptop",
        label: "Do I need a powerful laptop?",
        answer: "No. Anything from the last five years works. Install VS Code and Node.js before day 1, and keep 10 GB of disk free. The pre-work in the app lists the rest.",
        mood: "wink",
      },
    ],
  },
  {
    id: "ux-ui",
    name: "UX/UI classroom",
    scene: "/tour/scene-ux-ui.svg",
    sceneAlt: "Illustrated design classroom with research walls covered in sticky notes, printed wireframes and a shared table with laptops.",
    guide: "teaching-assistant",
    text: "I'm Inês, a Teaching Assistant. These walls hold your research: interview notes, sketches, user journeys. We run critiques here, and you'll design in Figma. Everyone starts by showing something unfinished.",
    mood: "smile",
    questions: [
      {
        id: "stuck-rule",
        label: "When should I ask for help?",
        answer: "After 20 minutes. Try on your own first, write down what you tried, then ask. If you ask after two hours, you've lost time. If you ask after two minutes, you've skipped the learning.",
        mood: "smile",
      },
      {
        id: "critique",
        label: "Will my work get torn apart in critiques?",
        answer: "No. Critiques are about the design, not you. The rule is one thing that works, one question, one suggestion. Your first one will feel scary. By the third you'll ask for more.",
        mood: "curious",
      },
      {
        id: "drawing",
        label: "Do I need to be able to draw?",
        answer: "No. Boxes, arrows and bad handwriting are enough. Figma is free for students, and we show you the basics in week one. Nobody here is judged on beauty.",
        mood: "wink",
      },
    ],
  },
  {
    id: "data",
    name: "Data classroom",
    scene: "/tour/scene-data.svg",
    sceneAlt: "Illustrated classroom with wide monitors showing charts and notebooks, and a long desk with laptops and coffee cups.",
    guide: "lead-teacher",
    text: "Rui again. Data runs on notebooks: you write Python, run it, read the result, then explain it. We use real datasets, messy ones included. Week 1 is setup, basic Python and a lot of tables. It's fine to feel lost.",
    mood: "curious",
    questions: [
      {
        id: "math",
        label: "Do I need to be good at maths?",
        answer: "School-level is enough: averages, percentages, a graph. We build the statistics as we go. Being curious about what the numbers say matters more than being fast at sums.",
        mood: "smile",
      },
      {
        id: "python-setup",
        label: "How do I set up Python?",
        answer: "Don't worry about it before day 1. We install it together in the first morning, so everyone has the same setup. If yours breaks later, bring it to a TA. It happens to everybody.",
        mood: "wink",
      },
      {
        id: "week-one",
        label: "What does week 1 feel like?",
        answer: "Long and full. You'll open a notebook, load a file, make your first chart and probably break something. By Friday you can read a table you couldn't read on Monday.",
        mood: "curious",
      },
    ],
  },
  {
    id: "open-space",
    name: "Open space and phone booths",
    scene: "/tour/scene-open-space.svg",
    sceneAlt: "Illustrated open-plan study area with long tables, two glass phone booths and a small meeting room in the background.",
    guide: "teaching-assistant",
    text: "This is where you study after class. Phone booths and the meeting room are booked on the sign-up sheet by the door, and the space stays open until 20:00. TAs hold office hours here after class.",
    mood: "smile",
    questions: [
      {
        id: "book-booth",
        label: "How do I book a booth or the meeting room?",
        answer: "Write your name on the sheet by the door. Booths are 30 minutes at a time, the meeting room is for groups of three or more. If nobody turns up after 10 minutes, it's free.",
        mood: "smile",
      },
      {
        id: "quiet-hours",
        label: "Is it quiet enough to concentrate?",
        answer: "Mostly. Quiet hours run from 9:00 to 13:00 and 14:00 to 17:00, so talk in the booths or the kitchen. After 17:00 it's looser, and pair work is welcome.",
        mood: "curious",
      },
      {
        id: "office-hours",
        label: "When can I find a Teaching Assistant?",
        answer: "Office hours are every weekday from 18:00 to 19:00, right here. Come with one specific question and what you've already tried. You'll get an answer faster than you think.",
        mood: "wink",
      },
    ],
  },
  {
    id: "kitchen",
    name: "Kitchen and lounge",
    scene: "/tour/scene-kitchen-lounge.svg",
    sceneAlt: "Illustrated kitchen and lounge with a coffee machine, a fridge, a foosball table, sofas and a board with Wi-Fi details on the wall.",
    guide: "program-manager",
    text: "Coffee is free, the fridge is shared, and lunch is at 13:00. The Wi-Fi details are on the board by the fridge. Wash your own cup, label your food, and keep a few minutes for the foosball table.",
    mood: "smile",
    questions: [
      {
        id: "lunch",
        label: "Where do people go for lunch?",
        answer: "Plenty of options within five minutes of the door: bakeries, a market hall, small places with a dish of the day for about 8 to 10 euros. Or bring lunch and use the microwave.",
        mood: "smile",
      },
      {
        id: "fridge-rules",
        label: "What are the fridge and dishes rules?",
        answer: "Write your name and the date on anything you leave. We clear unlabelled food on Friday afternoon. Dishes get washed, not left in the sink. It's the one rule Tiago asks me to repeat.",
        mood: "wink",
      },
      {
        id: "friday-drinks",
        label: "What are Friday drinks?",
        answer: "Optional and low key. At 18:15 on Fridays we put out drinks and snacks, and it's the best place to meet the other cohorts. Soft drinks are there too, and nobody counts.",
        mood: "curious",
      },
    ],
  },
  {
    id: "rooftop",
    name: "Rooftop terrace",
    scene: "/tour/scene-rooftop.svg",
    sceneAlt: "Illustrated rooftop terrace with wooden benches, potted plants and a view over Lisbon's rooftops towards the river.",
    guide: "career-coach",
    text: "I'm Joana, the Career Coach. Demo day and our career events happen up here, with the river behind you. We start on your CV and LinkedIn in the first weeks, and interview practice follows later.",
    mood: "smile",
    questions: [
      {
        id: "career-start",
        label: "When does career support actually start?",
        answer: "Early. CV and LinkedIn work starts in the first weeks, portfolio reviews come mid-program, and mock interviews in the last third. I'd rather you have a rough CV early than a perfect one late.",
        mood: "smile",
      },
      {
        id: "demo-day",
        label: "What happens on demo day?",
        answer: "You present your final project to the cohort, staff and invited guests from local companies, five minutes each. It's nerve-wracking, and people usually say it was their best day.",
        mood: "curious",
      },
      {
        id: "networking",
        label: "I hate networking. Do I have to?",
        answer: "Not the awkward kind. We run small events, and I'll tell you who to talk to and what to ask. Most introverts end up having better conversations than the people who work the room.",
        mood: "wink",
      },
    ],
  },
  {
    id: "farewell",
    name: "See you on day 1",
    scene: "/tour/scene-farewell.svg",
    sceneAlt: "Illustrated building entrance in the morning light with the glass door open and a few people walking in.",
    guide: "program-manager",
    text: "That's the tour. Before day 1, do three things: finish the pre-work tasks in the app, pack your ID and laptop, and say hi in the cohort chat. The full team list is in Contacts. See you at 8:45.",
    mood: "wink",
    questions: [
      {
        id: "forgot",
        label: "What if I forget something?",
        answer: "Then you forgot it, and we'll sort it out. Spare chargers live at reception. Whatever else it is, tell me or Tiago on the first morning and we'll find a way.",
        mood: "smile",
      },
    ],
  },
];
