import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy-initialized Gemini Client to prevent crashes during startup when key is pending.
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("La clé d'API 'GEMINI_API_KEY' n'est pas configurée dans les Secrets. Allez dans Paramètres > Secrets pour l'ajouter.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Dynamically construct response schema for SDG scoring
const oddProps: Record<string, any> = {};
for (let i = 1; i <= 17; i++) {
  oddProps[`odd${i}`] = {
    type: Type.OBJECT,
    properties: {
      score: {
        type: Type.INTEGER,
        description: `Score d'impact pour l'ODD ${i}. -1 = Risque d'impact négatif, 0 = Pas de contribution, 1 = Contribution marginale, 2 = Contribution indirecte significative, 3 = Contribution directe et principale.`
      },
      justification: {
        type: Type.STRING,
        description: `Courte justification de maximum 2 lignes (environ 120-150 caractères) dans un style neutre et professionnel de banque de développement en français. Laisser vide si le score est 0.`
      }
    },
    required: ["score", "justification"]
  };
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    ...oddProps,
    odd_principaux: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: "Liste de 1 à 3 numéros d'ODD (entre 1 et 17) qui constituent les contributions majeures et directes du projet (ceux ayant le score de 3, ou les scores les plus élevés)."
    },
    resume_global: {
      type: Type.STRING,
      description: "Un paragraphe synthétique et pragmatique en français (max 4 phrases) résumant la force de l'alignement environnemental et social globale de ce projet sous l'angle stratégique de la BOAD."
    }
  },
  required: [
    ...Object.keys(oddProps),
    "odd_principaux",
    "resume_global"
  ]
};

// API Endpoint for Project SDG Analysis
app.post("/api/analyze", async (req, res) => {
  try {
    const { titre, description, secteur, pays, montant } = req.body;

    if (!titre || !description) {
      return res.status(400).json({ error: "Le titre et la description du projet sont requis." });
    }

    const ai = getGeminiClient();

    const systemInstruction = `Tu es un expert renommé en développement durable et en financement de projets d'infrastructure et d'impact social en Afrique de l'Ouest. Tu travailles pour la Banque Ouest-Africaine de Développement (BOAD).
Ton rôle : analyser la description d'un projet de développement et lui attribuer un score d'alignement pour chacun des 17 Objectifs de Développement Durable (ODD) de l'ONU.

Échelle de scoring stricte de la BOAD :
- 3 = Contribution directe et principale (Le projet cible directement cet ODD comme objectif de premier plan)
- 2 = Contribution indirecte significative (Le projet engendre un impact positif mesurable et important sur cet ODD, bien qu'il ne soit pas l'objectif unique)
- 1 = Contribution marginale (Le projet a un effet bénéfique marginal, accessoire ou incident sur cet ODD)
- 0 = Pas de contribution (L'ODD n'a aucun rapport ou impact décelable avec l'activité du projet)
- -1 = Risque d'impact négatif (Le projet crée des pressions environnementales, sociales ou de gouvernance délétères sur cet objectif, à signaler avec attention)

Consignes de rédaction :
- Tu dois remplir l'ensemble des 17 ODD d'un score et d'une justification.
- Si le score vaut 0 (pas de contribution), la justification doit obligatoirement être un texte vide "".
- Pour tous les autres scores (-1, 1, 2, 3), fournis une justification synthétique et rigoureuse d'une à deux lignes en français. Parle du projet de manière professionnelle en mentionnant son secteur ou contexte ouest-africain.
- Ne larde pas ton analyse de jargon pompeux. Écris comme un analyste financier et d'impact senior de la BOAD.`;

    const prompt = `Voici un projet de développement ouest-africain à analyser et à évaluer par rapport aux 17 ODD de l'ONU :

TITRE DU PROJET: ${titre}
PAYS BÉNÉFICIAIRE: ${pays || "Membres de la BOAD (Union Économique et Monétaire Ouest-Africaine - UEMOA)"}
SECTEUR D'ACTIVITÉ: ${secteur || "Non spécifié"}
MONTANT PRÉVU: ${montant ? montant + " FCFA" : "Non spécifié"}

DESCRIPTION DU PROJET:
"""
${description}
"""

Évalue la contribution de ce projet pour chacun des 17 ODD sous forme de JSON structuré correspondant exactement au schéma demandé.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2, // Low temperature for high evaluation stability
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("L'API Gemini n'a renvoyé aucun contenu.");
    }

    const payload = JSON.parse(textOutput.trim());
    return res.json(payload);

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({
      error: error.message || "Une erreur interne s'est produite lors de l'analyse avec Gemini."
    });
  }
});

// Setup Vite & App Server routing
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error("Failed to start server", err);
});
