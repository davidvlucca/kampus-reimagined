// Conteúdo da visita virtual. Fica em código (não na BD) porque é igual para todos
// os alunos e só muda com uma nova versão da app.
// Cenários e guias: ilustrações SVG feitas para esta versão (client/public/tour/).
// As imagens de 2023 vinham do Google, sem licença, e saíram do projeto.

export const CAMPUS_NAME = "Kampus Lisbon"; // Campus fictício

export type GuideId = "program-manager" | "lead-teacher" | "teaching-assistant" | "career-coach";

export interface TourGuide {
  id: GuideId;
  /** Tem de bater com `staff_title` de um staff do seed. */
  title: string;
  image: string;
}

export const GUIDES: Record<GuideId, TourGuide> = {
  "program-manager": { id: "program-manager", title: "Program Manager", image: "/tour/guide-program-manager.svg" },
  "lead-teacher": { id: "lead-teacher", title: "Lead Teacher", image: "/tour/guide-lead-teacher.svg" },
  "teaching-assistant": { id: "teaching-assistant", title: "Teaching Assistant", image: "/tour/guide-teaching-assistant.svg" },
  "career-coach": { id: "career-coach", title: "Career Coach", image: "/tour/guide-career-coach.svg" },
};

export interface TourStop {
  id: string;
  name: string;
  scene: string;
  /** Descrição do cenário para leitores de ecrã. */
  sceneAlt: string;
  guide: GuideId;
  text: string;
}

export const TOUR_STOPS: readonly TourStop[] = [
  {
    id: "entrance",
    name: "Entrance",
    scene: "/tour/scene-entrance.svg",
    sceneAlt: "Illustrated campus building with a tall glass entrance, blue windows, trees and bikes outside.",
    guide: "program-manager",
    text: "Welcome to Kampus! I'm your Program Manager. This is the main entrance. Doors open at 8:30, and your student card opens the gate. Let's walk around together.",
  },
  {
    id: "web-dev",
    name: "Web Dev room",
    scene: "/tour/scene-web-dev.svg",
    sceneAlt: "Illustrated coding classroom with a big screen showing code, monitors and rows of desks with laptops.",
    guide: "lead-teacher",
    text: "This is the Web Dev room. You'll spend most of your days here, writing code, pairing with classmates and shipping projects. Bring your laptop and charger every day.",
  },
  {
    id: "ux-ui",
    name: "UX/UI room",
    scene: "/tour/scene-ux-ui.svg",
    sceneAlt: "Illustrated design studio with wireframes on a whiteboard, a wall of sticky notes and a big shared table.",
    guide: "teaching-assistant",
    text: "Here is the UX/UI room. The walls are covered in sticky notes for a reason: this is where research, sketches and prototypes happen. Feel free to grab a marker.",
  },
  {
    id: "data",
    name: "Data Analytics room",
    scene: "/tour/scene-data.svg",
    sceneAlt: "Illustrated data room with large screens showing bar, line and donut charts above a long desk.",
    guide: "career-coach",
    text: "This is the Data Analytics room. On Fridays I also run career workshops here: CVs, portfolios and interview practice. Come by whenever you have questions.",
  },
  {
    id: "kitchen",
    name: "Kitchen",
    scene: "/tour/scene-kitchen.svg",
    sceneAlt: "Illustrated shared kitchen with a sink, microwave, coffee machine, fridge and a round wooden table.",
    guide: "program-manager",
    text: "Hungry? This is the kitchen. There's a fridge, microwaves and free coffee. One rule: wash your cup and leave the space as you found it.",
  },
  {
    id: "lounge",
    name: "Lounge",
    scene: "/tour/scene-lounge.svg",
    sceneAlt: "Illustrated lounge with a coral sofa, an arc lamp, plants and a foosball table.",
    guide: "program-manager",
    text: "And this is the lounge, the place to take a break. Play a round of foosball, chat with other cohorts, or just rest your eyes for a few minutes.",
  },
  {
    id: "farewell",
    name: "See you soon",
    scene: "/tour/scene-entrance.svg",
    sceneAlt: "Illustrated campus building with a tall glass entrance, blue windows, trees and bikes outside.",
    guide: "program-manager",
    text: "That's the tour! Your tasks, notes and the staff contacts are waiting on your dashboard. You can take this tour again anytime from the menu. See you on campus!",
  },
];
