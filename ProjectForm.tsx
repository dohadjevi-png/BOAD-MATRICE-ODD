import { SdgDefinition, Project } from "../types";

export const SDGS: SdgDefinition[] = [
  {
    id: 1,
    numberStr: "01",
    title: "Pas de pauvreté",
    shortTitle: "Pauvreté",
    description: "Éliminer la pauvreté sous toutes ses formes et partout dans le monde.",
    color: "#E5243B",
    bgClass: "bg-[#E5243B]",
    textClass: "text-[#E5243B]"
  },
  {
    id: 2,
    numberStr: "02",
    title: "Faim « zéro »",
    shortTitle: "Faim Zéro",
    description: "Éliminer la faim, assurer la sécurité alimentaire, améliorer la nutrition et promouvoir l'agriculture durable.",
    color: "#DDA63A",
    bgClass: "bg-[#DDA63A]",
    textClass: "text-[#DDA63A]"
  },
  {
    id: 3,
    numberStr: "03",
    title: "Bonne santé et bien-être",
    shortTitle: "Santé",
    description: "Permettre à tous de vivre en bonne santé et promouvoir le bien-être de tous à tout âge.",
    color: "#4C9F38",
    bgClass: "bg-[#4C9F38]",
    textClass: "text-[#4C9F38]"
  },
  {
    id: 4,
    numberStr: "04",
    title: "Éducation de qualité",
    shortTitle: "Éducation",
    description: "Assurer l'accès de tous à une éducation de qualité, sur un pied d'égalité, et promouvoir les possibilités d'apprentissage tout au long de la vie.",
    color: "#C5192D",
    bgClass: "bg-[#C5192D]",
    textClass: "text-[#C5192D]"
  },
  {
    id: 5,
    numberStr: "05",
    title: "Égalité entre les sexes",
    shortTitle: "Égalité Sexes",
    description: "Parvenir à l'égalité des sexes et autonomiser toutes les femmes et les filles.",
    color: "#FF3A21",
    bgClass: "bg-[#FF3A21]",
    textClass: "text-[#FF3A21]"
  },
  {
    id: 6,
    numberStr: "06",
    title: "Eau propre et assainissement",
    shortTitle: "Eau & Assain.",
    description: "Garantir l'accès de tous à l'eau et à l'assainissement et assurer une gestion durable des ressources en eau.",
    color: "#26BDE2",
    bgClass: "bg-[#26BDE2]",
    textClass: "text-[#26BDE2]"
  },
  {
    id: 7,
    numberStr: "07",
    title: "Énergie propre et d'un coût abordable",
    shortTitle: "Énergie",
    description: "Garantir l'accès de tous à des services énergétiques fiables, durables et modernes, à un coût abordable.",
    color: "#FCC30B",
    bgClass: "bg-[#FCC30B]",
    textClass: "text-[#FCC30B]"
  },
  {
    id: 8,
    numberStr: "08",
    title: "Travail décent et croissance économique",
    shortTitle: "Travail & Crois.",
    description: "Promouvoir une croissance économique soutenue, partagée et durable, le plein emploi productif et un travail décent pour tous.",
    color: "#A21942",
    bgClass: "bg-[#A21942]",
    textClass: "text-[#A21942]"
  },
  {
    id: 9,
    numberStr: "09",
    title: "Industrie, innovation et infrastructure",
    shortTitle: "Infrastruct.",
    description: "Bâtir une infrastructure résiliente, promouvoir une industrialisation durable qui profite à tous et encourager l'innovation.",
    color: "#FD6925",
    bgClass: "bg-[#FD6925]",
    textClass: "text-[#FD6925]"
  },
  {
    id: 10,
    numberStr: "10",
    title: "Inégalités réduites",
    shortTitle: "Inégalités",
    description: "Réduire les inégalités dans les pays et d'un pays à l'autre.",
    color: "#DD1367",
    bgClass: "bg-[#DD1367]",
    textClass: "text-[#DD1367]"
  },
  {
    id: 11,
    numberStr: "11",
    title: "Villes et communautés durables",
    shortTitle: "Villes Dur.",
    description: "Faire en sorte que les villes et les établissements humains soient ouverts à tous, sûrs, résilients et durables.",
    color: "#FD9D24",
    bgClass: "bg-[#FD9D24]",
    textClass: "text-[#FD9D24]"
  },
  {
    id: 12,
    numberStr: "12",
    title: "Consommation et production responsables",
    shortTitle: "Conso. Resp.",
    description: "Instaurer des modes de consommation et de production durables.",
    color: "#BF8B2E",
    bgClass: "bg-[#BF8B2E]",
    textClass: "text-[#BF8B2E]"
  },
  {
    id: 13,
    numberStr: "13",
    title: "Mesures relatives à la lutte contre les changements climatiques",
    shortTitle: "Climat",
    description: "Prendre d'urgence des mesures pour lutter contre les changements climatiques et leurs répercussions.",
    color: "#3F7E44",
    bgClass: "bg-[#3F7E44]",
    textClass: "text-[#3F7E44]"
  },
  {
    id: 14,
    numberStr: "14",
    title: "Vie aquatique",
    shortTitle: "Vie Aqua.",
    description: "Conserver et exploiter de manière durable les océans, les mers et les ressources marines aux fins du développement durable.",
    color: "#0A97D9",
    bgClass: "bg-[#0A97D9]",
    textClass: "text-[#0A97D9]"
  },
  {
    id: 15,
    numberStr: "15",
    title: "Vie terrestre",
    shortTitle: "Vie Terr.",
    description: "Préserver et restaurer les écosystèmes terrestres, en veillant à les exploiter de façon durable, lutter contre la désertification et mettre fin à la perte de biodiversité.",
    color: "#56C02B",
    bgClass: "bg-[#56C02B]",
    textClass: "text-[#56C02B]"
  },
  {
    id: 16,
    numberStr: "16",
    title: "Paix, justice et institutions efficaces",
    shortTitle: "Justice/Paix",
    description: "Promouvoir l'avènement de sociétés pacifiques et inclusives aux fins du développement durable, assurer l'accès de tous à la justice.",
    color: "#00689D",
    bgClass: "bg-[#00689D]",
    textClass: "text-[#00689D]"
  },
  {
    id: 17,
    numberStr: "17",
    title: "Partenariats pour la réalisation des objectifs",
    shortTitle: "Partenariats",
    description: "Renforcer les moyens de mettre en œuvre le partenariat mondial pour le développement durable et le revitaliser.",
    color: "#19486A",
    bgClass: "bg-[#19486A]",
    textClass: "text-[#19486A]"
  }
];

export const BOAD_SECTORS = [
  "Agriculture et Développement Rural",
  "Infrastructures de Transport (Routes, Ports, Rail)",
  "Énergie et Énergies Renouvelables",
  "Eau, Assainissement et Environnement",
  "Éducation et Santé (Infrastructures Sociales)",
  "Télécommunications et Digitalisation",
  "Industries et Promotion des PME",
  "Secrétariat de la Finance et Microfinance",
  "Aménagement Urbain et Logement Social",
  "Tourisme et Hôtellerie"
];

export const BOAD_COUNTRIES = [
  "Bénin",
  "Burkina Faso",
  "Côte d'Ivoire",
  "Guinée-Bissau",
  "Mali",
  "Niger",
  "Sénégal",
  "Togo",
  "UEMOA (Régional)"
];

export const PRELOADED_PROJECTS: Project[] = [];
