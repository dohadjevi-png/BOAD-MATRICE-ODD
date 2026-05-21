/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, Loader2, RefreshCw, Layers, MapPin, DollarSign, HelpCircle } from "lucide-react";
import { BOAD_SECTORS, BOAD_COUNTRIES } from "../data/sdgData";
import { Project } from "../types";

// Helpful placeholders presets for user to test instantly!
const FORM_PRESETS = [
  {
    titre: "Électrification de mini-réseaux solaires ruraux à Tillabéri",
    secteur: "Énergie et Énergies Renouvelables",
    pays: "Mali",
    montant: "8 000 000 000",
    description: "Installation de mini-centrales solaires photovoltaïques autonomes de 50 kWc dans 25 villages ruraux reculés de la région frontalière du Niger et Mali. Le projet prévoit le déploiement d'un réseau basse tension local, l'installation de ballons d'eau chaude solaires collectifs, de l'éclairage public LED sécurisant, et le raccordement direct des centres de soins primaires ruraux pour alimenter la réfrigération des sérums."
  },
  {
    titre: "Protection côtière et réhabilitation du littoral Est de Cotonou",
    secteur: "Eau, Assainissement et Environnement",
    pays: "Bénin",
    montant: "21 500 000 000",
    description: "Construction d'une série d'épis de protection marine et d'enrochements d'une longueur totale de 4,5 km à l'Est de Cotonou pour stopper l'érosion côtière exacerbée. Ce projet permettra de réinstaller de manière sécurisée les communautés de pêcheurs artisanaux menacées de relocalisation, de sauvegarder la route interrégionale de desserte logistique et de stabiliser le niveau biologique du plan d'eau lagunaire."
  },
  {
    titre: "Modernisation des plateaux techniques médicaux hospitaliers",
    secteur: "Éducation et Santé (Infrastructures Sociales)",
    pays: "Togo",
    montant: "5 400 000 000",
    description: "Acquisition d'équipements d'imagerie médicale de pointe (IRM, scanner, radiologie numérique) pour équiper les centres hospitaliers régionaux (CHR) de Dapaong et d'Atakpamé au Togo. Ce projet englobe la remise à niveau des installations d'électricité de secours (onduleurs et panneaux solaires de secours) et la formation de 80 radiologues et techniciens locaux pour réduire les délais de diagnostic."
  }
];

interface ProjectFormProps {
  onProjectAdded: (project: Project) => void;
  userRole: "ANALYSTE" | "MANAGER";
}

export default function ProjectForm({ onProjectAdded, userRole }: ProjectFormProps) {
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [secteur, setSecteur] = useState(BOAD_SECTORS[0]);
  const [pays, setPays] = useState(BOAD_COUNTRIES[0]);
  const [montant, setMontant] = useState("");
  const [indicators, setIndicators] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isManager = userRole === "MANAGER";

  const applyPreset = (preset: typeof FORM_PRESETS[0]) => {
    if (isManager) return;
    setTitre(preset.titre);
    setDescription(preset.description);
    setSecteur(preset.secteur);
    setPays(preset.pays);
    setMontant(preset.montant);
    
    // Set matching preset indicators
    if (preset.titre.includes("Tillabéri")) {
      setIndicators("25 villages raccordés aux réseaux, 12 centres de soins électrifiés");
    } else if (preset.titre.includes("Cotonou")) {
      setIndicators("4,5 km de côtes sauvegardées, 2 500 familles à l'abri des ondes");
    } else if (preset.titre.includes("médicaux")) {
      setIndicators("80 praticiens de santé formés, 2 hôpitaux régionaux équipés");
    } else {
      setIndicators("");
    }
    setErrorMsg(null);
  };

  const clearForm = () => {
    if (isManager) return;
    setTitre("");
    setDescription("");
    setSecteur(BOAD_SECTORS[0]);
    setPays(BOAD_COUNTRIES[0]);
    setMontant("");
    setIndicators("");
    setErrorMsg(null);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titre.trim()) {
      setErrorMsg("Veuillez saisir un titre de projet.");
      return;
    }
    if (!description.trim() || description.length < 20) {
      setErrorMsg("Veuillez fournir une description détaillée du projet (minimum 20 caractères) pour une analyse pertinente.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setLoadingStep("Initialisation des paramètres BOAD...");

    try {
      setTimeout(() => setLoadingStep("Consultation de la matrice d'alignement ONU..."), 1500);
      setTimeout(() => setLoadingStep("Génération des justifications des 17 ODD d'impact..."), 3200);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre,
          description,
          secteur,
          pays,
          montant
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur d'analyse (Statut HTTP ${response.status}).`);
      }

      const analysisResult = await response.json();

      // Create new Project and save
      const newProject: Project = {
        id: "proj-" + Date.now(),
        titre,
        description,
        secteur,
        pays,
        montant: montant || "Non spécifié",
        createdAt: new Date().toISOString(),
        analysis: analysisResult,
        indicators: indicators.trim() || undefined,
        overrides: []
      };

      onProjectAdded(newProject);
      clearForm();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Une erreur s'est produite lors de l'appel au serveur d'analyse.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg border overflow-hidden ${isManager ? "border-amber-200/80 shadow-md" : "border-slate-200"}`} id="form-container">
      {/* Blue / Green gradient banner */}
      <div className={`px-6 py-4 border-b flex justify-between items-center text-white ${
        isManager 
          ? "bg-gradient-to-r from-amber-700 to-[#003366] border-amber-800"
          : "bg-gradient-to-r from-[#003366] to-[#004d99] border-blue-900"
      }`}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-400" />
          <h2 className="font-semibold text-lg">
            {isManager ? "Nouveau Projet (Mode Consultation)" : "Nouveau Projet à Évaluer"}
          </h2>
        </div>
        <button
          type="button"
          onClick={clearForm}
          disabled={isManager}
          className={`text-xs transition flex items-center gap-1 ${
            isManager 
              ? "text-amber-300/50 cursor-not-allowed" 
              : "text-blue-200 hover:text-white hover:underline cursor-pointer"
          }`}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recommencer
        </button>
      </div>

      <div className="p-6">
        {/* Role warning when Manager tries to view */}
        {isManager && (
          <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 p-4 rounded-r-lg text-xs text-amber-900 flex items-start gap-3 shadow-inner">
            <span className="text-xl select-none" role="img" aria-label="lock">🔒</span>
            <div>
              <span className="font-extrabold block text-amber-950 mb-0.5 uppercase tracking-wide">
                Lecture Seule active (Session Manager)
              </span>
              Vous visualisez l'interface d'évaluation en tant que <strong>Manager de l'Impact</strong>. Ce rôle vous offre des privilèges étendus pour l'analyse globale et l'exportation des données d'impact, mais la saisie de propositions et le déclenchement d'évaluations par IA sont réservés aux <strong>Analystes RSE</strong>.
              <span className="block mt-1 font-bold text-[#003366]">
                Astuce : Basculez votre rôle vers "Analyste" via le panneau d'utilisateur en haut pour activer la saisie.
              </span>
            </div>
          </div>
        )}

        {/* Helper quick pre-sets */}
        <div className={`mb-6 p-4 rounded-lg border ${
          isManager 
            ? "bg-slate-50 border-slate-200 text-slate-400 opacity-75" 
            : "bg-blue-50/70 border-blue-100"
        }`}>
          <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
            isManager ? "text-slate-500" : "text-blue-900"
          }`}>
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            Saisie Accélérée • Préréglages d'exemples de projets BOAD {isManager && "(Désactivé en mode Manager)"} :
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {FORM_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(preset)}
                disabled={isManager}
                className={`text-left text-xs p-2.5 rounded-md transition shadow-xs flex flex-col justify-between ${
                  isManager 
                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" 
                    : "bg-white hover:bg-emerald-50 border border-slate-200 hover:border-[#009933] cursor-pointer hover:translate-y-[-1px]"
                }`}
              >
                <div className="font-medium line-clamp-1 mb-1 text-slate-700">{preset.titre}</div>
                <div className="text-[10px] text-slate-400 flex justify-between w-full">
                  <span>{preset.pays}</span>
                  <span className="font-mono text-emerald-700/60 font-semibold">{preset.montant ? "FCFA" : ""}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Titre du Projet <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex. Aménagement d'un parc éolien d'appoint ou construction de digues..."
                className={`w-full text-sm border focus:ring-1 focus:ring-[#009933] rounded-lg px-3.5 py-2.5 outline-none transition ${
                  isManager 
                    ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed" 
                    : "border-slate-300 focus:border-[#009933]"
                }`}
                disabled={loading || isManager}
              />
            </div>

            {/* Sector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                Secteur d'Activité BOAD <span className="text-red-500">*</span>
              </label>
              <select
                value={secteur}
                onChange={(e) => setSecteur(e.target.value)}
                className={`w-full text-sm border focus:ring-1 focus:ring-[#009933] rounded-lg px-3 py-2.5 outline-none transition ${
                  isManager 
                    ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed" 
                    : "border-slate-300 focus:border-[#009933] cursor-pointer bg-white"
                }`}
                disabled={loading || isManager}
              >
                {BOAD_SECTORS.map((sec, idx) => (
                  <option key={idx} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                Pays Bénéficiaire <span className="text-red-500">*</span>
              </label>
              <select
                value={pays}
                onChange={(e) => setPays(e.target.value)}
                className={`w-full text-sm border focus:ring-1 focus:ring-[#009933] rounded-lg px-3 py-2.5 outline-none transition ${
                  isManager 
                    ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed" 
                    : "border-slate-300 focus:border-[#009933] cursor-pointer bg-white"
                }`}
                disabled={loading || isManager}
              >
                {BOAD_COUNTRIES.map((ctry, idx) => (
                  <option key={idx} value={ctry}>
                    {ctry}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                Montant Prévu (FCFA)
              </label>
              <input
                type="text"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="Ex: 12 500 000 000"
                className={`w-full text-sm border focus:ring-1 focus:ring-[#009933] rounded-lg px-3.5 py-2.5 outline-none transition ${
                  isManager 
                    ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed" 
                    : "border-slate-300 focus:border-[#009933]"
                }`}
                disabled={loading || isManager}
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Laisser vide ou saisir la valeur brute (ex. 12 500 000 000)</span>
            </div>

            {/* Indicators */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                Indicateurs de Suivi d'Impact
              </label>
              <input
                type="text"
                value={indicators}
                onChange={(e) => setIndicators(e.target.value)}
                placeholder="Ex: 75 000 foyers desservis, 30 MW développés"
                className={`w-full text-sm border focus:ring-1 focus:ring-[#009933] rounded-lg px-3.5 py-2.5 outline-none transition ${
                  isManager 
                    ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed" 
                    : "border-slate-300 focus:border-[#009933]"
                }`}
                disabled={loading || isManager}
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Spécifiez les objectifs chiffrés mesurables du projet</span>
            </div>

            {/* Project description */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Description et caractéristiques d'impact <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Décrivez les infrastructures créées, la zone géographique ciblée, les communautés concernées, les enjeux environnementaux prévus, de manière à ce que l'IA puisse en déduire un alignement de précision pour chaque ODD de l'ONU."
                className={`w-full text-sm border focus:ring-1 focus:ring-[#009933] rounded-lg p-3.5 outline-none transition resize-y font-sans ${
                  isManager 
                    ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed" 
                    : "border-slate-300 focus:border-[#009933] resize-none"
                }`}
                disabled={loading || isManager}
              />
              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                <span>Fournissez au moins 2-3 phrases explicatives détaillées.</span>
                <span className={description.length >= 20 ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                  {description.length} caractères
                </span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3.5 rounded-r-lg text-xs text-red-800">
              <span className="font-semibold block mb-0.5">Échec de l'évaluation :</span>
              {errorMsg}
              {errorMsg.includes("GEMINI_API_KEY") && (
                <span className="block mt-1 font-medium text-[11px] text-red-600">
                  Note : Vous devez insérer votre clé API Gemini personnelle via le panneau Secrets situé dans les Paramètres (en haut à droite de l'éditeur d'AI Studio) pour exécuter l'intelligence artificielle en direct.
                </span>
              )}
            </div>
          )}

          {/* Action Trigger button */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={loading || isManager}
              className={`w-full py-3.5 px-4 rounded-lg font-bold text-sm tracking-wide text-white transition flex items-center justify-center gap-2 shadow-md ${
                loading
                  ? "bg-slate-400 border-slate-500 cursor-not-allowed"
                  : isManager
                    ? "bg-slate-300 border-slate-200 text-slate-500 cursor-not-allowed hover:bg-slate-300"
                    : "bg-gradient-to-r from-[#003366] to-[#009933] hover:from-blue-900 hover:to-semibold hover:to-emerald-700 cursor-pointer"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                  <div className="text-left">
                    <span className="block text-sm font-semibold">Analyse de l'IA en cours...</span>
                    <span className="block text-[10px] opacity-80 font-normal mt-0.5">{loadingStep}</span>
                  </div>
                </>
              ) : isManager ? (
                <>
                  <span className="text-base">🔒</span>
                  <span>Action réservée aux Analystes</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-yellow-300 animate-pulse" />
                  <span>Analyser avec l'IA Gemini &amp; Assigner les ODD</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
