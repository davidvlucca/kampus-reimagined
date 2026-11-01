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
    name: "Entrance",
    scene: "/tour/scene-entrance.svg",
    sceneAlt: "Illustrated campus building with a tall glass entrance, blue windows, trees and bikes outside.",
    guide: "program-manager",
    text: "Welcome to Kampus! I'm your Program Manager. This is the main entrance. Doors open at 8:30, and your student card opens the gate. Let's walk around together.",
    mood: "smile",
    questions: [
      {
        id: "class-hours",
        label: "What time do classes start?",
        answer: "Classes run from 9:00 to 18:00, with lunch at 13:00. Doors open at 8:30, so there's time for a coffee first.",
        mood: "smile",
      },
      {
        id: "student-card",
        label: "Where do I get my student card?",
        answer: "At reception, on your first morning. Bring an ID with you. If the card ever stops working, come and find me.",
        mood: "wink",
      },
    ],
  },
  {
    id: "web-dev",
    name: "Web Dev room",
    scene: "/tour/scene-web-dev.svg",
    sceneAlt: "Illustrated coding classroom with a big screen showing code, monitors and rows of desks with laptops.",
    guide: "lead-teacher",
    text: "This is the Web Dev room. You'll spend most of your days here, writing code, pairing with classmates and shipping projects. Bring your laptop and charger every day.",
    mood: "smile",
    questions: [
      {
        id: "stuck",
        label: "What if I get stuck?",
        answer: "Everyone does, that's the job! Try on your own for 20 minutes, then ask a classmate or the TA. Asking early is a skill, not a weakness.",
        mood: "smile",
      },
      {
        id: "laptop",
        label: "Do I need a powerful laptop?",
        answer: "Not really. Any laptop from the last five years runs what we use. Install Node.js and VS Code before day one and you're set.",
        mood: "curious",
      },
    ],
  },
  {
    id: "ux-ui",
    name: "UX/UI room",
    scene: "/tour/scene-ux-ui.svg",
    sceneAlt: "Illustrated design studio with wireframes on a whiteboard, a wall of sticky notes and a big shared table.",
    guide: "teaching-assistant",
    text: "Here is the UX/UI room. The walls are covered in sticky notes for a reason: this is where research, sketches and prototypes happen. Feel free to grab a marker.",
    mood: "smile",
    questions: [
      {
        id: "drawing",
        label: "Do I need to know how to draw?",
        answer: "Not at all. Boxes and arrows are enough. We care about the idea, not the art.",
        mood: "smile",
      },
      {
        id: "after-class",
        label: "Can I use the room after class?",
        answer: "Yes, until 20:00. Just leave the sticky notes where they are: someone's research lives on that wall!",
        mood: "wink",
      },
    ],
  },
  {
    id: "data",
    name: "Data Analytics room",
    scene: "/tour/scene-data.svg",
    sceneAlt: "Illustrated data room with large screens showing bar, line and donut charts above a long desk.",
    guide: "career-coach",
    text: "This is the Data Analytics room. On Fridays I also run career workshops here: CVs, portfolios and interview practice. Come by whenever you have questions.",
    mood: "smile",
    questions: [
      {
        id: "cv",
        label: "When should I start my CV?",
        answer: "Now, honestly. A rough version in week one beats a perfect one in week nine. Book a chat with me and we'll start it together.",
        mood: "smile",
      },
      {
        id: "interviews",
        label: "Do you help with interviews?",
        answer: "Every Friday afternoon: mock interviews, real questions and honest feedback. It's the busiest workshop on campus.",
        mood: "wink",
      },
    ],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    scene: "/tour/scene-kitchen.svg",
    sceneAlt: "Illustrated shared kitchen with a sink, microwave, coffee machine, fridge and a round wooden table.",
    guide: "program-manager",
    text: "Hungry? This is the kitchen. There's a fridge, microwaves and free coffee. One rule: wash your cup and leave the space as you found it.",
    mood: "smile",
    questions: [
      {
        id: "coffee",
        label: "Is the coffee really free?",
        answer: "Really free! Beans, milk and oat milk. If the machine runs out of water, the tank is behind the left panel.",
        mood: "wink",
      },
      {
        id: "fridge",
        label: "Can I keep food in the fridge?",
        answer: "Yes, with your name and the date on it. Anything without a label goes out on Friday afternoon.",
        mood: "curious",
      },
    ],
  },
  {
    id: "lounge",
    name: "Lounge",
    scene: "/tour/scene-lounge.svg",
    sceneAlt: "Illustrated lounge with a coral sofa, an arc lamp, plants and a foosball table.",
    guide: "program-manager",
    text: "And this is the lounge, the place to take a break. Play a round of foosball, chat with other cohorts, or just rest your eyes for a few minutes.",
    mood: "smile",
    questions: [
      {
        id: "foosball",
        label: "Who's the foosball champion?",
        answer: "The Data Analytics cohort, for now. They say it's statistics. I say it's practice.",
        mood: "wink",
      },
      {
        id: "rest",
        label: "Is it okay to just rest here?",
        answer: "Of course. Short breaks help you learn. Ten minutes on the sofa beats an hour staring at the same bug.",
        mood: "smile",
      },
    ],
  },
  {
    id: "farewell",
    name: "See you soon",
    scene: "/tour/scene-entrance.svg",
    sceneAlt: "Illustrated campus building with a tall glass entrance, blue windows, trees and bikes outside.",
    guide: "program-manager",
    text: "That's the tour! Your tasks, notes and the staff contacts are waiting on your dashboard. You can take this tour again anytime from the menu. See you on campus!",
    mood: "wink",
    questions: [],
  },
];
