/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import Header from "./components/Header";
import ProjectForm from "./components/ProjectForm";
import LoginScreen from "./components/LoginScreen";
import { SDGS, BOAD_SECTORS, BOAD_COUNTRIES } from "./data/sdgData";
import { Project, SdgDefinition, SdgScore } from "./types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  Building, 
  MapPin, 
  Layers, 
  DollarSign, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Printer, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  ChevronRight,
  Info,
  Calendar,
  Layers3,
  X,
  Target,
  ArrowRight,
  LayoutDashboard,
  ArrowLeftRight,
  History,
  Activity,
  Edit3,
  Loader2,
  TrendingDown
} from "lucide-react";

// Firebase imports
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { collection, doc, setDoc, deleteDoc, query, orderBy, onSnapshot } from "firebase/firestore";

export default function App() {
  // Authentication & Session States
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Load projects dynamically from Firestore
  const [projects, setProjects] = useState<Project[]>([]);

  // Track the active selected project for detail deep-dives
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Track project ID pending confirmation for deletion (immune to sandbox window.confirm blocks)
  const [deletingProjId, setDeletingProjId] = useState<string | null>(null);

  // Form block drawer/expansion state
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Active User Profile Info (replaces hardcoded Analyste/Manager RBAC data)
  const userProfile = useMemo(() => {
    if (!currentUser) {
      return {
        name: "Visiteur BOAD",
        email: "",
        department: "BOAD",
        avatarInitials: "V",
        roleLabel: "Non authentifié"
      };
    }
    const email = currentUser.email || "";
    const displayName = currentUser.displayName || email.split("@")[0] || "Contributeur";
    return {
      name: displayName,
      email: email,
      department: "Division des Évaluations RSE",
      avatarInitials: displayName.charAt(0).toUpperCase(),
      roleLabel: "Analyste RSE principal"
    };
  }, [currentUser]);

  // Listen to Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sync projects with private Firestore space `users/{userId}/projects`
  useEffect(() => {
    if (!currentUser) {
      setProjects([]);
      setSelectedProjectId("");
      return;
    }

    const projectsPath = `users/${currentUser.uid}/projects`;
    const q = query(collection(db, projectsPath), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsList: Project[] = [];
      snapshot.forEach((snapshotDoc) => {
        projectsList.push({ id: snapshotDoc.id, ...snapshotDoc.data() } as Project);
      });

      setProjects(projectsList);
      // Default select first available project if none selected yet or selected is invalid
      setSelectedProjectId((prev) => {
        if (!prev || !projectsList.some(p => p.id === prev)) {
          return projectsList[0]?.id || "";
        }
        return prev;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, projectsPath);
    });

    return unsubscribe;
  }, [currentUser]);

  // Custom feedback/warnings state
  const [sessionToast, setSessionToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setSessionToast(msg);
  };

  // Filter and search parameters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState("Tous");
  const [selectedCountry, setSelectedCountry] = useState("Tous");
  const [selectedMinScore, setSelectedMinScore] = useState<string>("Tous"); // e.g., "3", "2", "-1"
  const [selectedSdgFilter, setSelectedSdgFilter] = useState<number | null>(null);

  // Modal / Detail state for when user clicks a specific cell in the grid
  const [cellFocus, setCellFocus] = useState<{
    project: Project;
    sdg: SdgDefinition;
    scoreData: SdgScore;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"matrix" | "dashboard" | "compare">("matrix");
  const [compareProjId1, setCompareProjId1] = useState<string>("");
  const [compareProjId2, setCompareProjId2] = useState<string>("");

  // Initialize comparison selections
  useEffect(() => {
    if (projects.length > 0) {
      if (!compareProjId1) setCompareProjId1(projects[0].id);
      if (!compareProjId2) {
        setCompareProjId2(projects[1]?.id || projects[0].id);
      }
    }
  }, [projects]);

  // Handle adding a new project
  const handleProjectAdded = async (newProject: Project) => {
    if (!currentUser) return;
    const path = `users/${currentUser.uid}/projects`;
    try {
      await setDoc(doc(db, path, newProject.id), newProject);
      setSelectedProjectId(newProject.id);
      setIsFormOpen(false); // Close the drawer/form upon successful creation
      triggerToast("Nouveau projet d'évaluation ajouté et enregistré dans Firestore.");
      // Jump scroll to top of details or grid
      window.scrollTo({ top: 300, behavior: "smooth" });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${newProject.id}`);
    }
  };

  // Delete a project from history once confirmed by the inline UI
  const handleDeleteProject = async (id: string) => {
    if (!currentUser) return;
    const path = `users/${currentUser.uid}/projects`;
    try {
      await deleteDoc(doc(db, path, id));
      if (selectedProjectId === id) {
        const remaining = projects.filter((p) => p.id !== id);
        setSelectedProjectId(remaining[0]?.id || "");
      }
      setDeletingProjId(null);
      triggerToast("Projet d'évaluation retiré de votre espace de données.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
    }
  };

  // Manual score override with auditing trail
  const handleUpdateScore = async (projectId: string, sdgId: number, newScore: number, reason: string) => {
    if (!currentUser) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project || !project.analysis) return;

    const key = `odd${sdgId}`;
    const oldScore = (project.analysis as any)[key]?.score ?? 0;

    // Clone and adjust analysis ODD
    const updatedAnalysis = {
      ...project.analysis,
      [key]: {
        score: newScore,
        justification: reason.trim() || `Score modifié manuellement face aux critères RSE BOAD (Précédent: ${oldScore}).`
      }
    };

    // Prepare trail audit log item
    const newLog = {
      id: "log-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      sdgId,
      oldScore,
      newScore,
      reason: reason.trim() || "Ajustement de notation par décision de commission BOAD",
      author: userProfile.name,
      timestamp: new Date().toISOString()
    };

    const updatedProject: Project = {
      ...project,
      analysis: updatedAnalysis as any,
      overrides: [newLog, ...(project.overrides || [])]
    };

    const path = `users/${currentUser.uid}/projects`;
    try {
      await setDoc(doc(db, path, projectId), updatedProject);
      triggerToast(`Notation ODD ${sdgId} modifiée à ${newScore} avec traçabilité.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${projectId}`);
    }
  };


  const getScoreBadgeStyles = (score: number) => {
    switch (score) {
      case 3:
        return {
          bg: "bg-[#009933] text-white hover:bg-emerald-700",
          label: "Direct",
          desc: "Contribution directe et principale",
          iconStyle: "bg-emerald-900/30 text-white"
        };
      case 2:
        return {
          bg: "bg-green-400 text-[#003366] hover:bg-green-500",
          label: "Indirect",
          desc: "Contribution indirecte significative",
          iconStyle: "bg-green-900/30 text-green-950"
        };
      case 1:
        return {
          bg: "bg-slate-300 text-slate-800 hover:bg-slate-400",
          label: "Marginal",
          desc: "Contribution marginale ou incidente",
          iconStyle: "bg-slate-700/25 text-slate-900"
        };
      case -1:
        return {
          bg: "bg-red-500 text-white animate-pulse hover:bg-red-600",
          label: "Alerte Risque",
          desc: "Risque d'impact négatif à atténuer !",
          iconStyle: "bg-red-950/40 text-white animate-spin"
        };
      default:
        return {
          bg: "bg-slate-100/80 text-slate-400 border border-slate-200 hover:bg-white hover:text-slate-600",
          label: "Neutre",
          desc: "Aucun lien ou pas de contribution",
          iconStyle: "bg-slate-300/30 text-slate-400"
        };
    }
  };


  // Filtered list computed instantly
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // 1. Search Query
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        p.titre.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.pays.toLowerCase().includes(query) ||
        p.secteur.toLowerCase().includes(query);

      // 2. Sector Filter
      const matchesSector = selectedSector === "Tous" || p.secteur === selectedSector;

      // 3. Country Filter
      const matchesCountry = selectedCountry === "Tous" || p.pays === selectedCountry;

      // 4. Principal SDG or specific contribution score
      let matchesScore = true;
      if (selectedMinScore !== "Tous" && p.analysis) {
        const targetMultiplier = parseInt(selectedMinScore);
        const scores = Object.keys(p.analysis)
          .filter(k => k.startsWith("odd"))
          .map(k => (p.analysis as any)[k]?.score as number);
        
        matchesScore = scores.includes(targetMultiplier);
      }

      // 5. Active SDG filter
      let matchesSdg = true;
      if (selectedSdgFilter !== null && p.analysis) {
        const key = `odd${selectedSdgFilter}`;
        const score = p.analysis[key]?.score;
        matchesSdg = score !== undefined && score >= 1; // has some level of positive contribution
      }

      return matchesSearch && matchesSector && matchesCountry && matchesScore && matchesSdg;
    });
  }, [projects, searchQuery, selectedSector, selectedCountry, selectedMinScore, selectedSdgFilter]);

  // Find the selected project object
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  // Cumulative Heatmap and Coverage calculations
  const alignmentHeatmap = useMemo(() => {
    const counts = SDGS.map((sdg) => {
      let sumValue = 0;
      let countDirect = 0;   // score 3
      let countIndirect = 0; // score 2
      let countMarginal = 0; // score 1
      let countNegatives = 0; // score -1
      let countProjectsWithData = 0;

      filteredProjects.forEach((p) => {
        if (p.analysis) {
          const scoreObj = (p.analysis as any)[`odd${sdg.id}`];
          if (scoreObj) {
            countProjectsWithData++;
            const s = scoreObj.score;
            if (s === 3) countDirect++;
            else if (s === 2) countIndirect++;
            else if (s === 1) countMarginal++;
            else if (s === -1) countNegatives++;
            
            // accumulate weight for simple height visualization
            sumValue += s === -1 ? -1 : s;
          }
        }
      });

      return {
        sdg,
        sumValue,
        countDirect,
        countIndirect,
        countMarginal,
        countNegatives,
        countProjectsWithData,
        scoreIndex: countProjectsWithData > 0 ? (sumValue / countProjectsWithData).toFixed(1) : "0"
      };
    });

    // Determine highest covered and gaps
    const sortedBySum = [...counts].sort((a, b) => b.sumValue - a.sumValue);
    const topCovered = sortedBySum.filter(c => c.sumValue > 0).slice(0, 3).map(c => c.sdg);
    const gaps = counts.filter(c => c.sumValue <= 0).map(c => c.sdg);

    return {
      counts,
      topCovered,
      gaps
    };
  }, [filteredProjects]);

  // CSV Exporter
  const exportToCSV = () => {
    if (filteredProjects.length === 0) {
      alert("Aucun projet à exporter pour le moment.");
      return;
    }

    // Header building
    let csvContent = "\uFEFF"; // BOM to support French accents in Excel
    csvContent += "ID;Titre;Secteur;Pays;Montant_FCFA;Date_Creation;";
    
    // Add 17 SDGs columns
    for (let i = 1; i <= 17; i++) {
      csvContent += `ODD${i}_Score;ODD${i}_Justification;`;
    }
    csvContent += "ODD_Principaux;Resume_Global\n";

    filteredProjects.forEach((p) => {
      const row = [
        p.id,
        `"${p.titre.replace(/"/g, '""')}"`,
        `"${p.secteur}"`,
        `"${p.pays}"`,
        `"${p.montant || "Non spécifié"}"`,
        `"${p.createdAt.split('T')[0]}"`
      ];

      // Add scores and justifications
      for (let i = 1; i <= 17; i++) {
        const key = `odd${i}`;
        const sdgScore = p.analysis ? (p.analysis as any)[key] : null;
        const scoreVal = sdgScore ? sdgScore.score : 0;
        const scoreJust = sdgScore ? sdgScore.justification.replace(/"/g, '""') : "";
        row.push(scoreVal);
        row.push(`"${scoreJust}"`);
      }

      // Add main SDGs and Global Summary
      const mainSdgs = p.analysis?.odd_principaux ? p.analysis.odd_principaux.join(", ") : "";
      const globalRes = p.analysis?.resume_global ? p.analysis.resume_global.replace(/"/g, '""') : "";
      
      row.push(`"${mainSdgs}"`);
      row.push(`"${globalRes}"`);

      csvContent += row.join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BOAD_Matrice_ODD_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Exporter using jsPDF and jspdf-autotable
  const exportToPDF = () => {
    if (projects.length === 0) {
      triggerToast("Aucun projet à exporter.");
      return;
    }

    try {
      // 1. Initialize Landscape A4 PDF
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const userEmail = userProfile.email || "contributeur@boad.org";
      const userName = userProfile.name || "Contributeur";
      const userRoleLabel = userProfile.roleLabel || "Analyste RSE principal";
      const dateStr = new Date().toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      const exportTimeStr = new Date().toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).replace(/\//g, "-");

      // Draw a page template helper
      const addHeaderAndFooter = (pdfDoc: jsPDF) => {
        const totalPagesCount = pdfDoc.getNumberOfPages();
        for (let i = 1; i <= totalPagesCount; i++) {
          pdfDoc.setPage(i);
          
          // Header
          pdfDoc.setDrawColor(0, 51, 102); // #003366 (BOAD Deep Blue)
          pdfDoc.setLineWidth(0.5);
          pdfDoc.line(15, 12, 282, 12); // top thin line

          pdfDoc.setFont("helvetica", "bold");
          pdfDoc.setFontSize(10);
          pdfDoc.setTextColor(0, 51, 102);
          pdfDoc.text("MATRICE ODD BOAD", 15, 8);

          pdfDoc.setFont("helvetica", "normal");
          pdfDoc.setFontSize(8);
          pdfDoc.setTextColor(100, 116, 139); // slate-500
          pdfDoc.text(`Date : ${dateStr} | Utilisateur : ${userName} (${userEmail})`, 282, 8, { align: "right" });

          // Footer
          pdfDoc.line(15, 198, 282, 198); // bottom line
          pdfDoc.setFont("helvetica", "italic");
          pdfDoc.setFontSize(8);
          pdfDoc.setTextColor(100, 116, 139);
          pdfDoc.text("Généré par l'outil Matrice ODD BOAD — BOAD", 15, 203);
          pdfDoc.text(`Page ${i} sur ${totalPagesCount}`, 282, 203, { align: "right" });
        }
      };

      // --- PAGE 1: COVER & PORTFOLIO SUMMARY ---
      // Document Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(0, 51, 102);
      doc.text("RAPPORT CONSOLIDÉ DE PORTEFOUILLE RSE", 15, 30);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text("Analyse d'alignement stratégique des interventions de la BOAD par rapport aux Objectifs de Développement Durable (ODD).", 15, 37);

      // Metadatas box
      doc.setFillColor(248, 250, 252); // slate-50 background block
      doc.rect(15, 42, 267, 24, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("INFORMATIONS DE SYNTHÈSE", 20, 48);

      doc.setFont("helvetica", "normal");
      doc.text(`Nombre total de projets évalués : ${projects.length}`, 20, 54);
      doc.text(`Rôle de l'auditeur : ${userRoleLabel}`, 20, 60);

      doc.text(`Date d'exportation : ${dateStr}`, 140, 54);
      doc.text(`Espace personnel de : ${userName} (${userEmail})`, 140, 60);

      // Section title for summary table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0, 51, 102);
      doc.text("Synthèse Globale des Évaluations d'Impact", 15, 76);

      // Generate summary table content
      const tableHeaders = [["Titre du projet", "Secteur d'Activité", "Pays d'Intervention", "SDG Majeurs", "Score Global RSE (Somme)"]];
      const tableRows = projects.map((p) => {
        // SDG Majeurs
        const mainSdgs = p.analysis?.odd_principaux 
          ? p.analysis.odd_principaux.map(id => `ODD ${id}`).join(", ") 
          : "Aucun";
        
        // Score Global (sum of all 17 score values)
        let sumScore = 0;
        if (p.analysis) {
          for (let i = 1; i <= 17; i++) {
            sumScore += p.analysis[`odd${i}`]?.score || 0;
          }
        }
        
        const sumScoreStr = sumScore > 0 ? `+${sumScore}` : `${sumScore}`;

        return [
          p.titre,
          p.secteur,
          p.pays,
          mainSdgs,
          sumScoreStr
        ];
      });

      // Draw Summary Table
      autoTable(doc, {
        startY: 82,
        head: tableHeaders,
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: [0, 51, 102], // `#003366` BOAD blue
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold"
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 80 }, // Title
          1: { cellWidth: 60 }, // Sector
          2: { cellWidth: 40 }, // Country
          3: { cellWidth: 45 }, // Main SDGS
          4: { cellWidth: 42, halign: "center" }  // Global Score
        },
        margin: { left: 15, right: 15 }
      });

      // --- PAGE 2+ : PROJECT SHEETS DETAILS ---
      projects.forEach((p) => {
        doc.addPage();

        // Project Title Header section
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(0, 51, 102);
        // limit the text so it does not overflow
        const fullTitle = p.titre.toUpperCase();
        const titleLines = doc.splitTextToSize(fullTitle, 267);
        doc.text(titleLines, 15, 25);

        // Calculate offset based on number of title lines
        const offset = (titleLines.length - 1) * 6;

        // Sub description details
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`Secteur : ${p.secteur}  |  Pays : ${p.pays}  |  Montant : ${p.montant || "Non spécifié"} FCFA`, 15, 32 + offset);

        // Project Description box
        doc.setFillColor(248, 250, 252);
        doc.rect(15, 36 + offset, 267, 18, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);

        const descText = p.description || "Aucune description fournie.";
        const splitDesc = doc.splitTextToSize(descText, 257);
        // limit description lines to 2 lines
        doc.text(splitDesc.slice(0, 2), 20, 42 + offset);

        // Detail 17 SDGs table for this project
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(0, 51, 102);
        doc.text("ANALYSE DÉTAILLÉE PAR OBJECTIF DE DÉVELOPPEMENT DURABLE (ODD)", 15, 61 + offset);

        const detailHeaders = [["Objectif ODD", "Score d'impact", "Justifications & Alignements Stratégiques"]];
        
        const detailRows = SDGS.map((sdg) => {
          const sdgScoreObj = p.analysis ? p.analysis[`odd${sdg.id}`] : null;
          const scoreVal = sdgScoreObj?.score ?? 0;
          const justification = sdgScoreObj?.justification || "Aucun alignement identifié.";

          let scoreLabel = "";
          switch (scoreVal) {
            case 3: scoreLabel = "+3 (Majeur)"; break;
            case 2: scoreLabel = "+2 (Indirect)"; break;
            case 1: scoreLabel = "+1 (Marginal)"; break;
            case -1: scoreLabel = "-1 (Risque/Éco)"; break;
            default: scoreLabel = "0 (Neutre)"; break;
          }

          return [
            `ODD ${sdg.id} - ${sdg.shortTitle}`,
            scoreLabel,
            justification
          ];
        });

        autoTable(doc, {
          startY: 65 + offset,
          head: detailHeaders,
          body: detailRows,
          theme: "grid",
          headStyles: {
            fillColor: [0, 51, 102],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: "bold"
          },
          bodyStyles: {
            fontSize: 8.5,
            textColor: [30, 41, 59]
          },
          columnStyles: {
            0: { cellWidth: 50, fontStyle: "bold" },
            1: { cellWidth: 35, halign: "center" },
            2: { cellWidth: 182 }
          },
          margin: { left: 15, right: 15, bottom: 25 }
        });

        // If there's a global summary, render it below the table
        const finalY = (doc as any).lastAutoTable.finalY || 160;
        if (p.analysis?.resume_global && finalY < 185) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(0, 51, 102);
          doc.text("RÉSUMÉ ANALYTIQUE GLOBAL :", 15, finalY + 8);

          doc.setFont("helvetica", "italic");
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);
          const splitSummary = doc.splitTextToSize(p.analysis.resume_global, 267);
          doc.text(splitSummary, 15, finalY + 13);
        }
      });

      // Apply headers and footers to all pages dynamically
      addHeaderAndFooter(doc);

      // Save PDF document
      doc.save(`MatriceODD_BOAD_${exportTimeStr}.pdf`);
      triggerToast("Rapport PDF exporté avec succès !");
    } catch (err) {
      console.error("Erreur d'export PDF:", err);
      triggerToast("Erreur lors de la génération du rapport PDF.");
    }
  };

  // Single Project PDF Exporter
  const exportSingleProjectToPDF = (p: Project) => {
    if (!p) return;

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const userEmail = userProfile.email || "contributeur@boad.org";
      const userName = userProfile.name || "Contributeur";
      const dateStr = new Date().toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      const exportTimeStr = new Date().toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).replace(/\//g, "-");

      const addHeaderAndFooter = (pdfDoc: jsPDF) => {
        const totalPagesCount = pdfDoc.getNumberOfPages();
        for (let i = 1; i <= totalPagesCount; i++) {
          pdfDoc.setPage(i);
          
          // Header
          pdfDoc.setDrawColor(0, 51, 102);
          pdfDoc.setLineWidth(0.5);
          pdfDoc.line(15, 12, 282, 12);

          pdfDoc.setFont("helvetica", "bold");
          pdfDoc.setFontSize(10);
          pdfDoc.setTextColor(0, 51, 102);
          pdfDoc.text("FICHE COMMERCIALE D'IMPACT ODD — BOAD", 15, 8);

          pdfDoc.setFont("helvetica", "normal");
          pdfDoc.setFontSize(8);
          pdfDoc.setTextColor(100, 116, 139);
          pdfDoc.text(`Date : ${dateStr} | Auditeur : ${userName}`, 282, 8, { align: "right" });

          // Footer
          pdfDoc.line(15, 198, 282, 198);
          pdfDoc.setFont("helvetica", "italic");
          pdfDoc.setFontSize(8);
          pdfDoc.setTextColor(100, 116, 139);
          pdfDoc.text("Généré par l'outil Matrice ODD BOAD — BOAD", 15, 203);
          pdfDoc.text(`Page ${i} sur ${totalPagesCount}`, 282, 203, { align: "right" });
        }
      };

      // Project Title Header section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(0, 51, 102);
      const fullTitle = p.titre.toUpperCase();
      const titleLines = doc.splitTextToSize(fullTitle, 267);
      doc.text(titleLines, 15, 25);

      const offset = (titleLines.length - 1) * 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Secteur : ${p.secteur}  |  Pays : ${p.pays}  |  Montant : ${p.montant || "Non spécifié"} FCFA`, 15, 32 + offset);

      doc.setFillColor(248, 250, 252);
      doc.rect(15, 36 + offset, 267, 18, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      const descText = p.description || "Aucune description fournie.";
      const splitDesc = doc.splitTextToSize(descText, 257);
      doc.text(splitDesc.slice(0, 2), 20, 42 + offset);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 51, 102);
      doc.text("ÉVALUATION D'ALIGNEMENT PAR OBJECTIF DE DÉVELOPPEMENT DURABLE (ODD)", 15, 61 + offset);

      const detailHeaders = [["Objectif ODD", "Score d'impact", "Justifications & Alignements Stratégiques"]];
      const detailRows = SDGS.map((sdg) => {
        const sdgScoreObj = p.analysis ? p.analysis[`odd${sdg.id}`] : null;
        const scoreVal = sdgScoreObj?.score ?? 0;
        const justification = sdgScoreObj?.justification || "Aucun alignement identifié.";

        let scoreLabel = "";
        switch (scoreVal) {
          case 3: scoreLabel = "+3 (Majeur)"; break;
          case 2: scoreLabel = "+2 (Indirect)"; break;
          case 1: scoreLabel = "+1 (Marginal)"; break;
          case -1: scoreLabel = "-1 (Risque/Éco)"; break;
          default: scoreLabel = "0 (Neutre)"; break;
        }

        return [
          `ODD ${sdg.id} - ${sdg.shortTitle}`,
          scoreLabel,
          justification
        ];
      });

      autoTable(doc, {
        startY: 65 + offset,
        head: detailHeaders,
        body: detailRows,
        theme: "grid",
        headStyles: {
          fillColor: [0, 51, 102],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold"
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: "bold" },
          1: { cellWidth: 35, halign: "center" },
          2: { cellWidth: 177 }
        },
        margin: { left: 15, right: 15, bottom: 25 }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 160;
      if (p.analysis?.resume_global && finalY < 185) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(0, 51, 102);
        doc.text("RÉSUMÉ ANALYTIQUE DE SYNTHÈSE :", 15, finalY + 8);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        const splitSummary = doc.splitTextToSize(p.analysis.resume_global, 267);
        doc.text(splitSummary, 15, finalY + 13);
      }

      addHeaderAndFooter(doc);
      doc.save(`FicheODD_${p.titre.substring(0, 15).replace(/\s+/g, "_")}_${exportTimeStr}.pdf`);
      triggerToast("Fiche RSE exportée avec succès en PDF !");
    } catch (err) {
      console.error(err);
      triggerToast("Erreur lors de l'export de la fiche.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      triggerToast("Déconnexion de la session BOAD réussie.");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center font-sans space-y-4">
          <Loader2 className="h-10 w-10 text-[#003366] animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest font-mono">
            Chargement de votre session BOAD...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onAuthSuccess={() => triggerToast("Bienvenue sur la plateforme d'évaluation BOAD !")} />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f8fafc] font-sans text-slate-800 print:bg-white print:text-black">
      
      {/* Header layout compliant back to Geometric Balance */}
      <Header 
        userEmail={currentUser.email} 
        userDisplayName={currentUser.displayName} 
        onLogout={handleLogout} 
      />

      {/* Sticky navigation tab bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:hidden">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab("matrix")}
              className={`py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition cursor-pointer select-none ${
                activeTab === "matrix"
                  ? "border-[#003366] text-[#003366] font-extrabold"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <Layers3 className="h-4.5 w-4.5 text-[#003366]" />
              <span>Matrice RSE &amp; Portefeuille</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("dashboard");
                setCellFocus(null);
              }}
              className={`py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition cursor-pointer select-none ${
                activeTab === "dashboard"
                  ? "border-[#003366] text-[#003366] font-extrabold"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <LayoutDashboard className="h-4.5 w-4.5 text-emerald-600" />
              <span>Tableau de Bord Stratégique</span>
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider">KPIs</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("compare");
                setCellFocus(null);
              }}
              className={`py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition cursor-pointer select-none ${
                activeTab === "compare"
                  ? "border-[#003366] text-[#003366] font-extrabold"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <ArrowLeftRight className="h-4.5 w-4.5 text-indigo-500 animate-pulse" />
              <span>Saisie Comparateur double</span>
              <span className="bg-blue-100 text-[#003366] text-[9px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider">Duo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main operational view / Matrix View */}
      {activeTab === "matrix" && (
        <main className="flex-1 flex flex-col xl:flex-row max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8 gap-6 print:p-0">
        
        {/* Left column: Controls, history and SDG rapid search */}
        <div className="w-full xl:w-1/4 flex flex-col gap-6 print:hidden">

          {/* Core BOAD statistics and CTA to open Form */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm">
            <h2 className="text-[#003366] text-sm uppercase font-mono tracking-wider font-extrabold mb-3 flex items-center justify-between">
              <span>Portefeuille Actuel</span>
              <span className="bg-[#003366] text-white px-2 py-0.5 rounded text-xs">{projects.length} Projets</span>
            </h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed font-sans">
              Évaluez les propositions de subvention et de prêt d'infrastructures de la BOAD selon les directives RSE de l'Union Économique et Monétaire Ouest-Africaine (UEMOA).
            </p>
            
            <button
              onClick={() => setIsFormOpen(!isFormOpen)}
              className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
                isFormOpen
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-gradient-to-r from-[#003366] to-[#009933] hover:brightness-110 text-white shadow-md hover:-translate-y-0.5"
              }`}
            >
              <Sparkles className="h-4 w-4 text-emerald-300" />
              <span>{isFormOpen ? "Masquer le formulaire" : "Évaluer un Nouveau Projet (+)"}</span>
            </button>
          </div>

          {/* SDG Creation Form - Drawer style when clicked */}
          {isFormOpen && (
            <div className="transition-all duration-300 transform animate-fadeIn">
              <ProjectForm onProjectAdded={handleProjectAdded} userRole="ANALYSTE" />
            </div>
          )}

          {/* Quick Portfolio Filter controls */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-xs font-mono uppercase text-[#003366] tracking-wider flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-[#009933]" />
                Filtrer l'Analyse
              </h3>
              {(searchQuery || selectedSector !== "Tous" || selectedCountry !== "Tous" || selectedMinScore !== "Tous" || selectedSdgFilter !== null) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSector("Tous");
                    setSelectedCountry("Tous");
                    setSelectedMinScore("Tous");
                    setSelectedSdgFilter(null);
                  }}
                  className="text-[10px] text-red-600 hover:underline cursor-pointer font-bold"
                >
                  Effacer
                </button>
              )}
            </div>

            {/* Keyword search filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Recherche par mot-clé
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Centrale, riz, coton, barrage..."
                  className="w-full text-xs border border-slate-300 rounded-lg py-2 pl-8 pr-3 outline-none focus:border-[#003366]/60 font-sans"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            {/* Pay filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Filtrer par Pays d'UEMOA
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full text-xs border border-slate-300 bg-white rounded-lg p-2 outline-none focus:border-[#003366]/60 cursor-pointer"
              >
                <option value="Tous">Tous les États membres ({BOAD_COUNTRIES.length})</option>
                {BOAD_COUNTRIES.map((cty, idx) => (
                  <option key={idx} value={cty}>
                    {cty}
                  </option>
                ))}
              </select>
            </div>

            {/* Sector filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Filtrer par Secteur BOAD
              </label>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full text-xs border border-slate-300 bg-white rounded-lg p-2 outline-none focus:border-[#003366]/60 cursor-pointer"
              >
                <option value="Tous">Tous les secteurs BOAD ({BOAD_SECTORS.length})</option>
                {BOAD_SECTORS.map((sec, idx) => (
                  <option key={idx} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Align Type Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Niveau d'Impact Minimum
              </label>
              <select
                value={selectedMinScore}
                onChange={(e) => setSelectedMinScore(e.target.value)}
                className="w-full text-xs border border-slate-300 bg-white rounded-lg p-2 outline-none focus:border-[#003366]/60 cursor-pointer"
              >
                <option value="Tous">Tout niveau de contribution</option>
                <option value="3">Contribution directe (Score 3)</option>
                <option value="2">Contribution indirecte (Score 2)</option>
                <option value="-1">Risque d'alerte détecté (Score -1)</option>
              </select>
            </div>

            {/* Filter by target SDG */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Cibler des ODD spécifiques
              </label>
              <div className="grid grid-cols-6 gap-1.5 mt-1.5">
                {SDGS.map((sdg) => {
                  const isSelected = selectedSdgFilter === sdg.id;
                  return (
                    <button
                      key={sdg.id}
                      type="button"
                      onClick={() => setSelectedSdgFilter(isSelected ? null : sdg.id)}
                      title={sdg.title}
                      style={{ backgroundColor: sdg.color }}
                      className={`h-7 rounded text-[10px] font-extrabold text-white flex items-center justify-center transition cursor-pointer relative hover:scale-105 active:scale-95 ${
                        isSelected 
                          ? "ring-2 ring-black ring-offset-2 scale-110 shadow-md"
                          : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      {sdg.id}
                      {isSelected && (
                        <span className="absolute -bottom-1 -right-1 bg-white border border-[#003366] text-[#003366] text-[8px] h-3.5 w-3.5 rounded-full flex items-center justify-center">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Cliquez sur un ODD pour restreindre la liste aux contributeurs actifs.</span>
            </div>
          </div>

          {/* List of Projects History in BOAD portfolio */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden max-h-[480px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-500">
                Historique des Projets ({filteredProjects.length})
              </h3>
            </div>
            
            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {projects.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs italic">
                  Aucun projet pour l'instant. Commencez par saisir un nouveau projet.
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs italic">
                  Aucun projet ne correspond aux filtres.
                </div>
              ) : (
                filteredProjects.map((p) => {
                  const isSelected = p.id === selectedProjectId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProjectId(p.id)}
                      className={`p-4 transition cursor-pointer flex flex-col gap-1.5 relative ${
                        isSelected 
                          ? "bg-slate-50 border-l-4 border-[#003366]" 
                          : "hover:bg-slate-50/50 bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-mono font-bold text-blue-800 bg-blue-100/75 px-1.5 py-0.5 rounded uppercase">
                          {p.pays}
                        </span>
                        {deletingProjId === p.id ? (
                          <div className="flex items-center gap-1.5 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[10px] animate-fadeIn">
                            <span className="text-red-700 font-bold font-sans">Supprimer ?</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(p.id);
                              }}
                              className="text-red-600 hover:text-red-800 font-bold px-1 transition duration-150 transform hover:scale-110"
                              title="Oui, retirer de l'espace de données"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingProjId(null);
                              }}
                              className="text-slate-400 hover:text-slate-600 font-bold px-1 transition duration-150 transform hover:scale-110"
                              title="Annuler"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingProjId(p.id);
                            }}
                            title="Supprimer ce projet"
                            className="transition cursor-pointer p-0.5 text-xs font-mono select-none text-slate-300 hover:text-red-500 font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <h4 className="text-xs font-extrabold text-slate-800 line-clamp-1">
                        {p.titre}
                      </h4>
                      <p className="text-[10px] text-slate-500 line-clamp-2">
                        {p.description}
                      </p>
                      
                      <div className="flex justify-between items-center text-[9px] mt-1 text-slate-400 font-mono">
                        <span className="font-semibold text-slate-600 truncate max-w-[140px]">{p.secteur}</span>
                        <span>{p.analysis?.odd_principaux ? `${p.analysis.odd_principaux.length} ODD` : "Non analysé"}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Right column: Interactive Matrix / Heatmap / Project deep dive details */}
        <div className="flex-1 flex flex-col gap-6">

          {/* Grid visualizer Section: Compliance to Geometric Balance styling */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm flex flex-col overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#003366] flex items-center gap-2">
                  <Layers3 className="h-5 w-5 text-[#009933]" />
                  Matrice Interactive d'Alignement Stratégique
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Vue panoramique de tous les projets enregistrés par rapport aux 17 ODD d'ONU. Cliquez sur les cellules pour inspecter la justification.
                </p>
              </div>

              {/* Actions & Export toolbar */}
              <div className="flex items-center gap-2.5 self-end sm:sm:auto print:hidden font-sans">
                <button
                  type="button"
                  onClick={exportToCSV}
                  className="bg-white border-2 border-[#003366] text-[#003366] hover:bg-slate-50 text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title="Télécharger l'intégralité du tableau de votre espace au format CSV"
                >
                  <FileSpreadsheet className="h-4 w-4" /> 
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={exportToPDF}
                  className="bg-[#003366] text-white hover:bg-[#002244] text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title="Générer et télécharger le rapport consolidé RSE d'impact en PDF"
                >
                  <Printer className="h-4 w-4" /> 
                  <span>Imprimer le Rapport (PDF)</span>
                </button>
              </div>
            </div>

            {/* SDG Columns Guide headers */}
            <div className="overflow-x-auto min-w-full">
              <div className="min-w-[840px] text-[10px] font-mono select-none">
                
                {/* 17 headers row */}
                <div className="grid grid-cols-[180px_1fr] bg-slate-100 rounded-t-lg p-2 border-b border-slate-200 font-extrabold text-slate-600 align-middle">
                  <div>Projets BOAD</div>
                  <div className="grid text-center font-bold" style={{ gridTemplateColumns: "repeat(17, minmax(0, 1fr))" }}>
                    {SDGS.map((sdg) => (
                      <div 
                        key={sdg.id} 
                        style={{ borderBottomColor: sdg.color }}
                        className="py-0.5 cursor-help hover:text-slate-900 border-b-2 flex flex-col items-center justify-center gap-0.5 select-none"
                        title={`${sdg.numberStr} - ${sdg.title}`}
                      >
                        <div className="w-5.5 h-5.5 rounded-full overflow-hidden border border-slate-200/60 shadow-inner flex items-center justify-center bg-white shrink-0">
                          <img 
                            src={`https://raw.githubusercontent.com/un-library/sdgs-art/master/languages/french/F_SDG_Goals_print-${sdg.numberStr}.png`} 
                            alt={sdg.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                          <span className="text-[7.5px] font-extrabold" style={{ color: sdg.color }}>{sdg.id}</span>
                        </div>
                        <span className="text-[8px] font-extrabold leading-none">{sdg.id}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grid rows loop */}
                <div className="divide-y divide-slate-100 border border-slate-200 border-t-0 rounded-b-lg">
                  {filteredProjects.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic">
                      Aucune matrice générée. Complétez le formulaire de projet ou réinitialisez les filtres.
                    </div>
                  ) : (
                    filteredProjects.map((p) => {
                      const isActive = p.id === selectedProjectId;
                      return (
                        <div 
                          key={p.id} 
                          onClick={() => setSelectedProjectId(p.id)}
                          className={`grid grid-cols-[180px_1fr] p-2 items-center cursor-pointer transition ${
                            isActive ? "bg-blue-50/75" : "hover:bg-slate-50/60 bg-white"
                          }`}
                        >
                          {/* Left label */}
                          <div className="pr-2">
                            <div className="font-extrabold text-slate-800 line-clamp-1 leading-tight">{p.titre}</div>
                            <div className="flex gap-1.5 items-center mt-0.5 text-[8px] text-slate-500 font-mono">
                              <span className="font-bold text-slate-600 uppercase">{p.pays}</span>
                              <span>•</span>
                              <span>{p.montant ? `${p.montant} F` : "Non chiffré"}</span>
                            </div>
                          </div>

                          {/* 17 indicators block */}
                          <div className="grid text-center h-8 gap-0.5 py-0.5" style={{ gridTemplateColumns: "repeat(17, minmax(0, 1fr))" }}>
                            {SDGS.map((sdg) => {
                              const sdgScore: SdgScore = p.analysis 
                                ? (p.analysis as any)[`odd${sdg.id}`] 
                                : { score: 0, justification: "" };
                              
                              const scoreValue = sdgScore?.score ?? 0;
                              const styleSetting = getScoreBadgeStyles(scoreValue);
                              
                              return (
                                <button
                                  key={sdg.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProjectId(p.id);
                                    setCellFocus({
                                      project: p,
                                      sdg: sdg,
                                      scoreData: sdgScore
                                    });
                                  }}
                                  className={`rounded h-full font-bold text-xs transition flex items-center justify-center cursor-pointer relative group ${styleSetting.bg}`}
                                  title={`ODD ${sdg.id} - ${sdg.shortTitle}: score ${scoreValue}`}
                                >
                                  {scoreValue === -1 ? "!" : scoreValue}
                                  
                                  {/* Tooltip for cell hovering */}
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white rounded text-[10px] hidden group-hover:block z-50 shadow-md font-sans text-left pointer-events-none">
                                    <div className="font-extrabold text-[#009933] border-b border-slate-700 pb-1 mb-1">
                                      ODD {sdg.id} - {sdg.shortTitle}
                                    </div>
                                    <div className="mb-1"><span className="font-bold">Score :</span> {scoreValue} ({styleSetting.label})</div>
                                    {sdgScore?.justification && (
                                      <div className="italic text-slate-300 line-clamp-3">"{sdgScore.justification}"</div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </div>

            {/* Scale legend labels */}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono border-t border-slate-100 pt-3 text-slate-500 font-semibold uppercase">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-[#009933] flex items-center justify-center text-[10px] text-white font-extrabold">3</span>
                <span>Contribution directe et principale</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-green-400 flex items-center justify-center text-[10px] text-[#003366] font-extrabold">2</span>
                <span>Contribution indirecte significative</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-slate-300 flex items-center justify-center text-[10px] text-slate-800 font-extrabold">1</span>
                <span>Contribution marginale</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-extrabold">0</span>
                <span>Inactif (Pas de contribution)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-red-500 flex items-center justify-center text-[10px] text-white font-extrabold animate-pulse">!</span>
                <span className="text-red-600">Risque d'impact négatif</span>
              </div>
            </div>
          </div>

          {/* Cell Focus Interactive Justification Overlay Block */}
          {cellFocus && (
            <div className="bg-emerald-50 border border-[#009933]/40 p-4.5 rounded-xl shadow-sm animate-fadeIn relative">
              <button 
                type="button" 
                onClick={() => setCellFocus(null)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 text-sm font-bold font-mono cursor-pointer"
              >
                ✕
              </button>
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left Panel: SDG Info & current justification */}
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div 
                      className="px-2.5 py-1.5 rounded text-white text-base font-extrabold flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: cellFocus.sdg.color }}
                    >
                      {cellFocus.sdg.id}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest">
                        Inspection ODD {cellFocus.sdg.id} • {cellFocus.sdg.title}
                      </h4>
                      <h5 className="font-extrabold text-[#003366] text-sm mt-0.5">
                        Projet : {cellFocus.project.titre} ({cellFocus.project.pays})
                      </h5>
                      
                      {/* Status Indicator inside highlight card */}
                      <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold mt-1 px-2 py-0.5 rounded bg-white border border-slate-200/80 text-slate-700">
                        <span className={`w-2 h-2 rounded-full ${
                          cellFocus.scoreData.score === 3 ? "bg-[#009933]" :
                          cellFocus.scoreData.score === 2 ? "bg-green-400" :
                          cellFocus.scoreData.score === -1 ? "bg-red-500 animate-pulse" : "bg-slate-400"
                        }`}></span>
                        <span>Score actuel : {cellFocus.scoreData.score ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-slate-800 italic mt-3 bg-white p-3 rounded-lg border border-slate-100 leading-normal">
                    {cellFocus.scoreData.justification ? `"${cellFocus.scoreData.justification}"` : "Aucune contribution spécifique pour cet objectif de développement durable dans ce secteur."}
                  </p>
                </div>

                {/* Right Panel: Manual Override Form (Traceability & Auditor Tool) */}
                <div className="w-full md:w-[380px] bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h5 className="font-extrabold text-[#003366] text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Edit3 className="h-4 w-4 text-emerald-600" />
                      Ajustement Expert de Notation RSE
                    </h5>
                    <p className="text-[10px] text-slate-400 mb-3.5 leading-normal">
                      Les analystes accrédités peuvent corriger la notation système du modèle d'évaluation de la BOAD. Toute correction est dûment enregistrée.
                    </p>

                    <div className="mb-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Cocher le score RSE corrigé :</label>
                      <div className="flex gap-1.5">
                        {[-1, 0, 1, 2, 3].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setCellFocus((prev) => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  scoreData: {
                                    ...prev.scoreData,
                                    score: s
                                  }
                                };
                              });
                            }}
                            className={`px-3 py-1.5 text-xs rounded-md font-mono font-bold border transition shrink-0 ${
                              cellFocus.scoreData.score === s
                                ? "bg-[#003366] text-white border-[#003366] scale-105"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {s === -1 ? "-1 🚨" : s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Motif formel de correction :</label>
                      <input
                        id="override-reason-input"
                        type="text"
                        placeholder="Ex. Alignement affiné après rapport RSE du promoteur..."
                        className="w-full text-xs border border-slate-300 rounded-md px-2.5 py-2 outline-none focus:border-[#003366]"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-3 flex justify-between items-center bg-slate-50 -mx-4 -mb-4 p-3 rounded-b-xl">
                    <span className="text-[9px] text-slate-400 font-mono">Signataire : {userProfile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const inputEl = document.getElementById("override-reason-input") as HTMLInputElement;
                        const reasonText = inputEl?.value?.trim() || "Ajustement expert par décision de commission BOAD";
                        handleUpdateScore(
                          cellFocus.project.id,
                          cellFocus.sdg.number,
                          cellFocus.scoreData.score,
                          reasonText
                        );
                        setCellFocus(null);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-lg shadow-xs transition cursor-pointer select-none"
                    >
                      Sauvegarder l'Ajustement
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Heatmap & ODD gaps summary dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* ODD Gaps analysis card */}
            <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-widest mb-3 flex items-center gap-1">
                  <Target className="h-4 w-4 text-orange-500" />
                  Zones d'Impact &amp; Gaps ({filteredProjects.length} Pr.)
                </h3>

                {filteredProjects.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">En attente de projets...</p>
                ) : (
                  <div className="space-y-4">
                    {/* Top alignment fields */}
                    <div>
                      <span className="text-[10px] font-extrabold text-emerald-800 uppercase bg-emerald-50 px-2 py-0.5 rounded block w-max mb-1.5">
                        ODD Fortement Couverts
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {alignmentHeatmap.topCovered.length === 0 ? (
                          <span className="text-xs text-slate-400">Aucun ODD couvert.</span>
                        ) : (
                          alignmentHeatmap.topCovered.map((sdg) => (
                            <span 
                              key={sdg.id} 
                              title={sdg.title}
                              className="text-[10px] font-bold text-white px-2 py-1 rounded select-none cursor-default"
                              style={{ backgroundColor: sdg.color }}
                            >
                              ODD {sdg.id} ({sdg.shortTitle})
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Gaps detected */}
                    <div>
                      <span className="text-[10px] font-extrabold text-amber-800 uppercase bg-amber-50 px-2 py-0.5 rounded block w-max mb-1.5">
                        Zones de Gaps (Pas de contribution)
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
                        {alignmentHeatmap.gaps.length === 0 ? (
                          <span className="text-xs text-slate-400">Tous les ODD sont couverts !</span>
                        ) : (
                          alignmentHeatmap.gaps.slice(0, 5).map((sdg) => (
                            <span 
                              key={sdg.id} 
                              title={sdg.title}
                              className="text-[9px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded truncate max-w-[124px] select-none cursor-help"
                            >
                              ODD {sdg.id} {sdg.shortTitle}
                            </span>
                          ))
                        )}
                        {alignmentHeatmap.gaps.length > 5 && (
                          <span className="text-[9px] text-slate-400 font-mono py-0.5 px-1 font-bold">
                            +{alignmentHeatmap.gaps.length - 5} autres
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-[10px] text-xs text-slate-400 mt-4 leading-snug border-t border-slate-100 pt-2.5">
                Utile pour réorienter l'allocation des fonds de la BOAD vers l'Afrique de l'Ouest.
              </div>
            </div>

            {/* Heatmap Bar graph */}
            <div className="md:col-span-2 bg-[#003366] text-white rounded-xl p-5 shadow-inner relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10 w-full">
                <div className="flex justify-between items-center mb-2.5">
                  <h3 className="text-xs font-bold text-blue-200 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-[#009933]" />
                    Intensité d'Impact global du Portefeuille
                  </h3>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest">
                    Score Cumulé Poids-ODD
                  </span>
                </div>

                {filteredProjects.length === 0 ? (
                  <div className="h-28 flex items-center justify-center text-blue-300/60 text-xs italic">
                    Aucun projet à visualiser. Veuillez enregistrer un projet ci-contre.
                  </div>
                ) : (
                  <div className="flex items-end space-x-1.5 h-28 pt-2">
                    {alignmentHeatmap.counts.map((val) => {
                      // Max value cap to prevent overflow, minimum 4% as indicator
                      const calculatedPercentage = val.sumValue > 0 
                        ? Math.min(100, Math.max(4, (val.sumValue / (filteredProjects.length * 3)) * 100)) 
                        : val.sumValue < 0 ? 12 : 3;

                      return (
                        <div 
                          key={val.sdg.id} 
                          className="flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer"
                          onClick={() => setSelectedSdgFilter(selectedSdgFilter === val.sdg.id ? null : val.sdg.id)}
                        >
                          {/* Sdg Bar */}
                          <div 
                            style={{ 
                              height: `${calculatedPercentage}%`,
                              backgroundColor: val.sumValue < 0 ? "#EF4444" : val.sdg.color 
                            }}
                            className={`w-full rounded-t transition-all duration-300 filter hover:brightness-125 ${
                              selectedSdgFilter === val.sdg.id ? "ring-2 ring-white scale-y-105" : ""
                            }`}
                          ></div>

                          {/* Index key footer */}
                          <div className={`text-[8px] font-bold font-mono mt-1 text-center scale-90 ${
                            selectedSdgFilter === val.sdg.id ? "text-emerald-400 font-extrabold" : "text-blue-200"
                          }`}>
                            {val.sdg.id}
                          </div>

                          {/* Float hovering stats popup */}
                          <div className="absolute bottom-full mb-2 w-40 p-2 bg-slate-900 text-white rounded text-[9px] shadow-xl border border-slate-700 font-sans hidden group-hover:block z-50 pointer-events-none text-left">
                            <div className="font-extrabold border-b border-slate-700 pb-1 mb-1" style={{ color: val.sdg.color }}>
                              ODD {val.sdg.id} - {val.sdg.shortTitle}
                            </div>
                            <div className="font-medium text-slate-300">
                              <div>• Contribution cumulative : <span className="font-mono text-white font-bold">{val.sumValue}</span></div>
                              <div>• Directe (Score 3) : <span className="text-emerald-400 font-bold">{val.countDirect}</span></div>
                              <div>• Indirecte (Score 2) : <span className="text-green-300 font-bold">{val.countIndirect}</span></div>
                              <div>• Alerte Risques (-1) : <span className="text-red-400 font-bold">{val.countNegatives}</span></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="relative z-10 flex justify-between items-center text-[10px] text-blue-300 mt-4 border-t border-blue-800/60 pt-2 font-mono">
                <span>Cliquez sur l'une des barres d'ODD pour l'isoler dans le volet filtre actif.</span>
                <span className="font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                  Rouge = Alerte de risque d'impact négatif (-1)
                </span>
              </div>
              
              <div className="absolute -right-8 -bottom-8 opacity-5 select-none pointer-events-none">
                <Target className="h-32 w-32 text-white" />
              </div>
            </div>

          </div>

          {/* Bottom section: Selected Project Deep Dive & Individual details sheet */}
          {selectedProject ? (
            <div className="bg-white rounded-xl shadow-lg border-2 border-[#003366]/10 overflow-hidden print:border-none print:shadow-none" id="project-detail-section">
              
              {/* Report Header card style */}
              <div className="bg-slate-50 p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-2 text-xs font-mono font-bold text-blue-800 mb-1.5 uppercase">
                    <span className="bg-[#003366] text-white px-2 py-0.5 rounded flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {selectedProject.pays}
                    </span>
                    <span className="bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 flex items-center gap-1">
                      <Building className="h-3 w-3" /> {selectedProject.secteur}
                    </span>
                    {selectedProject.montant && selectedProject.montant !== "Non spécifié" && (
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> {selectedProject.montant} FCFA
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-extrabold text-[#003366]">
                    {selectedProject.titre}
                  </h2>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                    <Calendar className="h-3 w-3" /> Rapport d'impact BOAD généré le {new Date(selectedProject.createdAt).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                {/* Print badge for selected sheet */}
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={() => exportSingleProjectToPDF(selectedProject)}
                    className="bg-slate-100 hover:bg-slate-200 text-[#003366] text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    title="Générer et télécharger la fiche RSE de ce projet en PDF"
                  >
                    <Printer className="h-4 w-4 text-[#009933]" /> Imprimer cette fiche
                  </button>
                </div>
              </div>

              {/* Fiche body */}
              <div className="p-6 space-y-6">
                
                {/* Descriptive recap */}
                <div>
                  <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Info className="h-3.5 w-3.5 text-[#003366]" />
                    Description Technique Détaillée du Projet
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/50 p-4 rounded-lg border border-slate-100 font-sans">
                    {selectedProject.description}
                  </p>
                </div>

                {/* Impact Follow-up Indicators */}
                <div>
                  <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5 text-[#009933]" />
                    Indicateurs de Suivi d'Impact RSE
                  </h4>
                  <div className="bg-emerald-50/45 p-4 rounded-xl border border-[#009933]/15 font-sans">
                    {selectedProject.indicators ? (
                      <div className="flex items-start gap-2.5">
                        <span className="text-md">📊</span>
                        <div>
                          <p className="text-xs text-slate-700 font-bold leading-relaxed">
                            {selectedProject.indicators}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Aucun indicateur de suivi global enregistré.</span>
                    )}
                  </div>
                </div>

                {/* Audit trail / Expert Correction Logs */}
                {selectedProject.overrides && selectedProject.overrides.length > 0 && (
                  <div>
                    <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-indigo-600" />
                      Registre d'Audit &amp; Traçabilité des Corrections RSE ({selectedProject.overrides.length})
                    </h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-150">
                      {selectedProject.overrides.map((log, idx) => (
                        <div key={idx} className="p-3 text-xs flex flex-col sm:flex-row justify-between sm:items-center gap-2 hover:bg-slate-100/50 transition duration-150">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-slate-200 text-slate-800 font-mono font-extrabold px-1.5 py-0.5 rounded text-[9px]">ODD {log.sdgId}</span>
                            <span className="text-slate-500 font-medium">Correction de {log.oldScore} vers</span>
                            <span className="bg-[#003366] text-white font-mono font-extrabold px-1.5 py-0.5 rounded text-[9px]">{log.newScore}</span>
                            <span className="text-slate-700 font-medium bg-white px-2 py-0.5 rounded border border-slate-100">Motif : "{log.reason}"</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 shrink-0">
                            <span>Par : {log.author}</span>
                            <span>•</span>
                            <span>{new Date(log.timestamp).toLocaleDateString('fr-FR')} {new Date(log.timestamp).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Global AI impact review card */}
                {selectedProject.analysis?.resume_global && (
                  <div className="bg-gradient-to-br from-[#003366]/5 to-[#009933]/5 border-l-4 border-l-[#003366] border-y border-r border-[#003366]/10 p-5 rounded-r-xl">
                    <h4 className="text-xs font-mono font-bold text-[#003366] uppercase tracking-wider mb-2.5 flex items-center gap-1.5 select-none">
                      <Sparkles className="h-4 w-4 text-[#009933] animate-pulse" />
                      Résumé Analytique d'Impact Global de la BOAD (IA Gemini)
                    </h4>
                    <p className="text-sm font-sans font-medium text-slate-800 leading-relaxed italic">
                      "{selectedProject.analysis.resume_global}"
                    </p>
                  </div>
                )}

                {/* Main key SDGs */}
                {selectedProject.analysis?.odd_principaux && selectedProject.analysis.odd_principaux.length > 0 && (
                  <div>
                    <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                      <Target className="h-4 w-4 text-[#009933]" />
                      Objectifs Stratégiques Majeurs de l'Intervention
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      {selectedProject.analysis.odd_principaux.map((id) => {
                        const sdgDef = SDGS.find((s) => s.id === id);
                        if (!sdgDef) return null;
                        
                        const sdgScore: SdgScore = selectedProject.analysis 
                          ? (selectedProject.analysis as any)[`odd${id}`] 
                          : { score: 1, justification: "" };

                        return (
                          <div 
                            key={id} 
                            className="bg-white border rounded-xl overflow-hidden shadow-xs hover:border-[#003366]/30 transition"
                          >
                            <div 
                              className="p-3 text-white flex items-center justify-between text-xs font-extrabold select-none"
                              style={{ backgroundColor: sdgDef.color }}
                            >
                              <span className="truncate">ODD {sdgDef.id} — {sdgDef.shortTitle}</span>
                              <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">Majeur (3)</span>
                            </div>
                            <div className="p-3 text-xs text-slate-600 font-sans leading-normal bg-slate-50/20 italic">
                              "{sdgScore?.justification || sdgDef.description}"
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Complete 17 SDG Scorecards evaluations list with justifications */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-[#009933]" />
                      Évaluation Détaillé d'alignement par ODD
                    </h4>
                    <span className="text-[10.5px] font-semibold text-[#003366] uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-mono">
                      Normes de rapportage BOAD-ODD v2.1
                    </span>
                  </div>

                  <div className="space-y-2 border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
                    {SDGS.map((sdg) => {
                      const sdgScore: SdgScore = selectedProject.analysis 
                        ? (selectedProject.analysis as any)[`odd${sdg.id}`]
                        : { score: 0, justification: "" };

                      const scoreVal = sdgScore?.score ?? 0;
                      const isMainSdg = selectedProject.analysis?.odd_principaux?.includes(sdg.id);
                      const styleSetting = getScoreBadgeStyles(scoreVal);

                      return (
                        <div 
                          key={sdg.id} 
                          className={`p-3 sm:p-4 grid grid-cols-1 md:grid-cols-[200px_80px_1fr] items-center gap-3 transition ${
                            scoreVal !== 0 ? "bg-white" : "bg-slate-50/40 opacity-70"
                          }`}
                        >
                          {/* Sdg title info */}
                          <div className="flex items-center gap-2.5">
                            <span 
                              className="w-8 h-8 rounded text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0 shadow-inner"
                              style={{ backgroundColor: sdg.color }}
                            >
                              {sdg.id}
                            </span>
                            <div>
                              <div className="text-xs font-extrabold text-slate-800 leading-tight">{sdg.shortTitle}</div>
                              <div className="text-[9px] text-slate-400 line-clamp-1">{sdg.title}</div>
                            </div>
                          </div>

                          {/* Sdg score representation */}
                          <div>
                            <span className={`inline-flex items-center justify-center text-[10px] uppercase font-mono tracking-wider px-2 py-1.5 rounded-md font-extrabold w-full text-center select-none shadow-xs ${styleSetting.bg}`}>
                              {scoreVal > 0 ? `+${scoreVal}` : scoreVal}
                            </span>
                          </div>

                          {/* SDG justification */}
                          <div className="text-xs text-slate-700 font-sans leading-relaxed">
                            {scoreVal === 0 ? (
                              <span className="text-slate-400 italic">Aucune incidence ou relation décelée.</span>
                            ) : (
                              <div className="flex gap-2.5 items-start">
                                {scoreVal === -1 && (
                                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5 animate-pulse" />
                                )}
                                {isMainSdg && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[8px] font-mono leading-none tracking-wider font-extrabold px-1.5 py-0.5 rounded-sm flex-shrink-0 mt-0.5 uppercase">
                                    Majeur
                                  </span>
                                )}
                                <span className={scoreVal === -1 ? "text-red-700 font-medium" : "text-slate-700"}>
                                  {sdgScore.justification}
                                </span>
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Signatures / validation footer strictly for Printing PDF layout context */}
                <div className="hidden print:block pt-16 border-t border-dashed mt-12 bg-white">
                  <div className="grid grid-cols-2 text-center text-xs font-mono">
                    <div>
                      <p className="font-extrabold uppercase text-[#003366]">Le Comité d'Analyse RSE &amp; ODD</p>
                      <p className="text-[10px] text-slate-400 mt-1">Visa pour signature d'alignement</p>
                      <div className="h-16 w-32 border border-dashed rounded mx-auto mt-2 flex items-center justify-center text-[9px] text-slate-300">
                        Tampon BOAD
                      </div>
                    </div>
                    <div>
                      <p className="font-extrabold uppercase text-[#003366]">La Direction des Risques d'Impact</p>
                      <p className="text-[10px] text-slate-400 mt-1">Acceptation et notation de financement</p>
                      <div className="h-16 w-32 border border-dashed rounded mx-auto mt-2 flex items-center justify-center text-[9px] text-slate-300">
                        Signature BOAD
                      </div>
                    </div>
                  </div>
                  <div className="text-center text-[9px] text-slate-300 mt-8">
                    Rapport certifié authentique basé sur l'IA Gemini • UEMOA Officiel
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 border border-slate-200 text-center text-slate-500 font-sans flex flex-col items-center justify-center gap-4">
              <span className="text-4xl text-slate-300">📁</span>
              {projects.length === 0 ? (
                <p className="text-sm font-medium text-slate-600">
                  Aucun projet pour l'instant. Commencez par saisir un nouveau projet.
                </p>
              ) : (
                <p className="text-sm font-medium text-slate-600">
                  Veuillez sélectionner un projet dans l'historique de gauche pour explorer l'audit d'alignement d'impact.
                </p>
              )}
            </div>
          )}

        </div>

      </main>
      )}

      {/* Tableau de Bord Stratégique RSE View - Empty State */}
      {activeTab === "dashboard" && projects.length === 0 && (
        <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8 gap-6 print:p-0 animate-fadeIn space-y-6">
          <div className="bg-white rounded-xl p-12 border border-slate-200 text-center text-slate-500 font-sans flex flex-col items-center justify-center gap-4">
            <span className="text-4xl">📊</span>
            <p className="text-sm font-medium text-slate-600">
              Aucun projet pour l'instant. Commencez par saisir un nouveau projet pour alimenter le tableau de bord ODD.
            </p>
          </div>
        </main>
      )}

      {/* Tableau de Bord Stratégique RSE View */}
      {activeTab === "dashboard" && projects.length > 0 && (
        <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8 gap-6 print:p-0 animate-fadeIn space-y-6">
          
          {/* Dashboard Header Summary */}
          <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-[#003366] text-xl font-extrabold tracking-tight flex items-center gap-2">
                <LayoutDashboard className="h-6 w-6 text-emerald-600" />
                Tableau de Bord Stratégique ODD
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Visualisez la consolidation d'alignement globale des financements de la BOAD vis-à-vis des 17 ODD de l'ONU.
              </p>
            </div>
            
            <div className="flex gap-2.5">
              <span className="bg-[#003366] text-white px-3 py-1.5 rounded-lg text-xs font-bold font-mono">
                Portefeuille Global : {(projects.reduce((acc, p) => { const stripped = (p.montant || "").replace(/[^0-9]/g, ""); const val = parseInt(stripped, 10); return acc + (isNaN(val) ? 0 : val); }, 0) / 1_000_000_000).toFixed(1)} Mrds FCFA
              </span>
              <span className="bg-[#009933] text-white px-3 py-1.5 rounded-lg text-xs font-bold font-mono">
                {projects.length} Projets Actifs
              </span>
            </div>
          </div>

          {/* KPI Dashboard Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Count */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-sm transition flex items-center gap-4">
              <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100">
                <Building className="h-6 w-6 text-[#003366]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Volume de Projets</p>
                <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">{projects.length}</h3>
                <p className="text-[10px] text-slate-500">Projets analysés au total</p>
              </div>
            </div>

            {/* Card 2: Top covered SDG */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-sm transition flex items-center gap-4">
              <div className="bg-emerald-50 p-2.5 rounded-full border border-emerald-100 flex-shrink-0">
                {(() => {
                  if (projects.length === 0) return null;
                  let maxVal = -Infinity;
                  let selectedSdgObj = null;
                  alignmentHeatmap.counts.forEach((item) => {
                    if (item.sumValue > maxVal) {
                      maxVal = item.sumValue;
                      selectedSdgObj = item;
                    }
                  });
                  const topSdg = selectedSdgObj && selectedSdgObj.sumValue > 0 ? selectedSdgObj.sdg : null;
                  return topSdg ? (
                    <div className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center">
                      <img 
                        src={`https://raw.githubusercontent.com/un-library/sdgs-art/master/languages/french/F_SDG_Goals_print-${topSdg.numberStr}.png`} 
                        alt={topSdg.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                      <span className="text-emerald-900 font-extrabold font-mono text-sm">{topSdg.id}</span>
                    </div>
                  ) : (
                    <Target className="h-8 w-8 text-[#009933]" />
                  );
                })()}
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">ODD le plus couvert</p>
                <h3 className="text-sm font-extrabold text-slate-800 truncate max-w-[170px]">
                  {(() => {
                    if (projects.length === 0) return "N/A";
                    let maxVal = -Infinity;
                    let selectedSdgObj = null;
                    alignmentHeatmap.counts.forEach((item) => {
                      if (item.sumValue > maxVal) {
                        maxVal = item.sumValue;
                        selectedSdgObj = item;
                      }
                    });
                    const topSdg = selectedSdgObj && selectedSdgObj.sumValue > 0 ? selectedSdgObj.sdg : null;
                    return topSdg ? `ODD ${topSdg.id} — ${topSdg.shortTitle}` : "Aucun";
                  })()}
                </h3>
                <p className="text-[10px] text-slate-500">Priorité de financement majeure</p>
              </div>
            </div>

            {/* Card 3: SDG Gaps with mean < 0.5 */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-sm transition flex items-center gap-4">
              <div className="bg-orange-50 p-3.5 rounded-xl border border-orange-100">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Déficit d'impact (Gaps)</p>
                <h3 className="text-2xl font-extrabold text-[#003366] tracking-tight">
                  {alignmentHeatmap.counts.filter((val) => val.countProjectsWithData > 0 && (val.sumValue / val.countProjectsWithData) < 0.5).length} ODDs
                </h3>
                <p className="text-[10px] text-slate-500">Moyenne de contribution &lt; 0.5</p>
              </div>
            </div>

            {/* Card 4: Aligned Financials */}
            <div className="bg-white rounded-xl p-5 border border-[#009933]/20 shadow-xs hover:shadow-sm transition flex items-center gap-4">
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100">
                <DollarSign className="h-6 w-6 text-[#009933]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Budget total aligné</p>
                <h3 className="text-sm font-black text-emerald-800 font-mono">
                  {(() => {
                    const totalBudget = projects.reduce((acc, p) => {
                      const stripped = (p.montant || "").replace(/[^0-9]/g, "");
                      const val = parseInt(stripped, 10);
                      return acc + (isNaN(val) ? 0 : val);
                    }, 0);
                    return totalBudget > 0 ? `${new Intl.NumberFormat("fr-FR").format(totalBudget)} FCFA` : "Non spécifié";
                  })()}
                </h3>
                <p className="text-[10px] text-slate-500">Fonds cumulés évalués RSE</p>
              </div>
            </div>
          </div>

          {/* Secondary Dashboard Sections: detailed gaps & pictorial view */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Box: SDG gaps and coverage analysis */}
            <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-sm space-y-5">
              <h3 className="text-sm font-bold text-[#003366] uppercase font-mono tracking-widest border-b pb-2 flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-orange-500" />
                Analyse Détaillée des Écarts de Financement (Gaps RSE)
              </h3>
              
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2">
                {(() => {
                  const gaps = alignmentHeatmap.counts.filter((val) => val.countProjectsWithData > 0 && (val.sumValue / val.countProjectsWithData) < 0.5);
                  if (gaps.length === 0) {
                    return <p className="text-xs text-slate-400 italic">Tous les ODD sont activement financés sans gap (score moyen &ge; 0.5).</p>;
                  }
                  return gaps.map((val) => {
                    const avg = val.sumValue / val.countProjectsWithData;
                    return (
                      <div key={val.sdg.id} className="bg-slate-50/50 hover:bg-slate-50 p-3.5 rounded-lg border border-slate-100 flex items-center justify-between gap-4 transition">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 border border-slate-200 bg-white flex items-center justify-center shadow-xs">
                            <img 
                              src={`https://raw.githubusercontent.com/un-library/sdgs-art/master/languages/french/F_SDG_Goals_print-${val.sdg.numberStr}.png`} 
                              alt={val.sdg.title}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                            <span className="font-extrabold text-[#003366] text-xs font-mono">{val.sdg.id}</span>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 leading-tight">ODD {val.sdg.id} — {val.sdg.shortTitle}</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5 max-w-[300px] line-clamp-1">{val.sdg.title}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md font-mono">
                            Moyenne: {avg.toFixed(2)} / 3.0
                          </span>
                          <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5 ml-auto">
                            <div className="bg-orange-500 h-full rounded-full" style={{ width: `${(avg / 3) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Right Box: The 17 UN Official SDGs Matrix Gallery */}
            <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#003366] uppercase font-mono tracking-widest border-b pb-2 flex items-center gap-2 mb-4">
                  <Layers className="h-4.5 w-4.5 text-[#009933]" />
                  Matrice des Pictogrammes Officiels de l'ONU
                </h3>
                <p className="text-xs text-slate-500 mb-4 font-sans leading-relaxed">
                  Cliquez sur un pictogramme officiel d'objectif ci-dessous pour filtrer en direct les projets ayant une contribution positive dans ce domaine au sein du portefeuille BOAD.
                </p>
                
                {/* Pictogram Matrix */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {SDGS.map((sdg) => {
                    const val = alignmentHeatmap.counts.find((c) => c.sdg.id === sdg.id);
                    const isFocus = selectedSdgFilter === sdg.id;
                    const scaleScore = val ? val.sumValue : 0;

                    return (
                      <button
                        key={sdg.id}
                        type="button"
                        onClick={() => setSelectedSdgFilter(selectedSdgFilter === sdg.id ? null : sdg.id)}
                        className={`relative rounded-xl overflow-hidden aspect-square border transition cursor-pointer select-none group/btn ${
                          isFocus 
                            ? "border-[#003366] ring-3 ring-blue-500/30 scale-105" 
                            : "border-slate-200/70 hover:border-slate-400 hover:scale-102"
                        }`}
                        title={`${sdg.id} - ${sdg.shortTitle} (Score cumulé: ${scaleScore})`}
                      >
                        <img 
                          src={`https://raw.githubusercontent.com/un-library/sdgs-art/master/languages/french/F_SDG_Goals_print-${sdg.numberStr}.png`}
                          alt={sdg.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover group-hover/btn:scale-110 transition duration-300"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        {/* Overlay score representation */}
                        <div className="absolute inset-x-0 bottom-0 bg-slate-900/85 text-white py-0.5 text-[8.5px] font-mono font-bold leading-normal text-center select-none truncate">
                          ODD {sdg.id} ({scaleScore > 0 ? `+${scaleScore}` : scaleScore})
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-center text-[9.5px] text-slate-400 mt-4 leading-relaxed bg-slate-50 p-2.5 rounded-lg border">
                <strong>Astuce décisionnelle :</strong> Les pictogrammes avec un score élevé représentent la force de frappe verte de la sous-région UEMOA.
              </div>
            </div>
          </div>

          {/* Interventions index listing for the filtered SDG */}
          <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>Portefeuille de Financement Filtré {selectedSdgFilter ? `(ODD ${selectedSdgFilter})` : "(Général)"}</span>
              {selectedSdgFilter && (
                <button 
                  onClick={() => setSelectedSdgFilter(null)}
                  className="text-xs text-blue-600 hover:underline hover:text-blue-900 font-extrabold cursor-pointer"
                >
                  Désactiver le filtre ODD
                </button>
              )}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
              {filteredProjects.map((p) => {
                const specScore = selectedSdgFilter && p.analysis ? (p.analysis as any)[`odd${selectedSdgFilter}`]?.score ?? 0 : null;
                return (
                  <div key={p.id} className="bg-slate-50 border border-slate-200/60 rounded-xl p-4.5 shadow-xs hover:border-[#003366]/20 transition flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wide">{p.pays}</span>
                        {specScore !== null && (
                          <span className={`text-[9px] font-extrabold font-mono px-2 py-0.5 rounded ${
                            specScore === 3 ? "bg-[#009933] text-white" : "bg-white border text-slate-700"
                          }`}>
                            ODD {selectedSdgFilter} : Score {specScore}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1 mb-1.5">{p.titre}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-3">{p.description}</p>
                    </div>

                    <div className="border-t border-slate-200/50 pt-2.5 flex justify-between items-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      <span>{p.secteur}</span>
                      <span className="font-mono text-[#009933] font-bold">{p.montant}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </main>
      )}

      {/* Mode Comparatif Double View */}
      {activeTab === "compare" && (
        <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8 gap-6 print:p-0 animate-fadeIn space-y-6">
          {/* Comparison Controls */}
          <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-sm">
            <h2 className="text-[#003366] text-xl font-extrabold tracking-tight flex items-center gap-2 mb-2">
              <ArrowLeftRight className="h-6 w-6 text-indigo-600 animate-pulse" />
              Mode Comparatif RSE double (Duo-Audit)
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Sélectionnez deux propositions d'aménagement dans la base de données de la BOAD pour évaluer côte à côte leur impact respectif pour chacun des 17 ODD d'impact.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Selector 1 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase font-mono tracking-wider mb-2">
                  Sélectionner le Projet n°1 :
                </label>
                <select
                  value={compareProjId1}
                  onChange={(e) => setCompareProjId1(e.target.value)}
                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-3 outline-none focus:border-[#003366] cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.titre} ({p.pays})</option>
                  ))}
                </select>
              </div>

              {/* Selector 2 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase font-mono tracking-wider mb-2">
                  Sélectionner le Projet n°2 :
                </label>
                <select
                  value={compareProjId2}
                  onChange={(e) => setCompareProjId2(e.target.value)}
                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-3 outline-none focus:border-[#003366] cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.titre} ({p.pays})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Main comparative grid or side-by-side matrices */}
          {(() => {
            const p1 = projects.find((x) => x.id === compareProjId1);
            const p2 = projects.find((x) => x.id === compareProjId2);

            if (projects.length === 0) {
              return (
                <div className="bg-white rounded-xl p-12 border border-slate-200 text-center text-slate-500 font-sans flex flex-col items-center justify-center gap-4">
                  <span className="text-4xl text-slate-300 animate-bounce">🗂️</span>
                  <p className="text-sm font-medium text-slate-600">
                    Aucun projet pour l'instant. Commencez par saisir un nouveau projet.
                  </p>
                </div>
              );
            }

            if (!p1 || !p2) {
              return (
                <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-slate-400 italic font-sans">
                  Veuillez enregistrer au moins deux projets dans l'historique RSE pour activer le mode comparatif.
                </div>
              );
            }

            return (
              <div className="space-y-6">
                
                {/* Visual side-by-side header cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card 1 */}
                  <div className="bg-[#003366] text-white rounded-xl p-5 border shadow-sm relative overflow-hidden">
                    <span className="absolute top-3 right-3 bg-white/20 px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold tracking-wider">Projet Global Gauche</span>
                    <h3 className="text-sm font-extrabold uppercase text-emerald-400 font-mono tracking-wide">{p1.pays}</h3>
                    <h4 className="text-base font-extrabold mt-1 line-clamp-1">{p1.titre}</h4>
                    <p className="text-xs text-slate-200/90 mt-2 leading-relaxed line-clamp-2">{p1.description}</p>
                    <div className="mt-3.5 border-t border-white/10 pt-2.5 flex justify-between items-center text-[10px] font-mono">
                      <span>{p1.secteur}</span>
                      <span className="font-bold text-emerald-300">{p1.montant} FCFA</span>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-slate-800 text-white rounded-xl p-5 border shadow-sm relative overflow-hidden">
                    <span className="absolute top-3 right-3 bg-white/20 px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold tracking-wider">Projet Global Droite</span>
                    <h3 className="text-sm font-extrabold uppercase text-blue-400 font-mono tracking-wide">{p2.pays}</h3>
                    <h4 className="text-base font-extrabold mt-1 line-clamp-1">{p2.titre}</h4>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed line-clamp-2">{p2.description}</p>
                    <div className="mt-3.5 border-t border-white/10 pt-2.5 flex justify-between items-center text-[10px] font-mono">
                      <span>{p2.secteur}</span>
                      <span className="font-bold text-blue-300">{p2.montant} FCFA</span>
                    </div>
                  </div>
                </div>

                {/* Score list grid column layouts */}
                <div className="bg-white rounded-xl border border-slate-200/95 overflow-hidden shadow-sm">
                  {/* Grid header */}
                  <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_1fr] bg-slate-50 border-b border-slate-200 p-3.5 text-xs font-bold uppercase tracking-wider text-[#003366] font-mono">
                    <div>Objectif (ODD UN)</div>
                    <div>{p1.titre.substring(0, 30)}... (GAUCHE)</div>
                    <div>{p2.titre.substring(0, 30)}... (DROITE)</div>
                  </div>

                  {/* Complete ODD evaluation comparison list */}
                  <div className="divide-y divide-slate-150">
                    {SDGS.map((sdg) => {
                      const score1: SdgScore = p1.analysis ? (p1.analysis as any)[`odd${sdg.id}`] : { score: 0, justification: "" };
                      const score2: SdgScore = p2.analysis ? (p2.analysis as any)[`odd${sdg.id}`] : { score: 0, justification: "" };

                      const val1 = score1?.score ?? 0;
                      const val2 = score2?.score ?? 0;

                      const badge1 = getScoreBadgeStyles(val1);
                      const badge2 = getScoreBadgeStyles(val2);

                      return (
                        <div key={sdg.id} className="grid grid-cols-1 md:grid-cols-[200px_1fr_1fr] p-4 items-start gap-4 hover:bg-slate-50/50 transition duration-150">
                          {/* Left Column: SDG Label */}
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 border border-slate-200 bg-white shadow-xs flex items-center justify-center">
                              <img 
                                src={`https://raw.githubusercontent.com/un-library/sdgs-art/master/languages/french/F_SDG_Goals_print-${sdg.numberStr}.png`} 
                                alt={sdg.title}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                              <span className="font-extrabold text-[#003366] text-xs font-mono">{sdg.id}</span>
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-slate-800 leading-tight">ODD {sdg.id}</div>
                              <div className="text-[10px] text-slate-400 font-semibold truncate max-w-[130px]" title={sdg.title}>{sdg.shortTitle}</div>
                            </div>
                          </div>

                          {/* P1 Column */}
                          <div className={`p-3 rounded-xl border ${val1 > val2 ? "bg-emerald-50/30 border-emerald-500/20" : "bg-[#f8fafc] border-slate-100"}`}>
                            <div className="flex items-center gap-2 mb-1.5 justify-between">
                              <span className={`text-[9px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded ${badge1.bg}`}>
                                Score : {val1 > 0 ? `+${val1}` : val1}
                              </span>
                              {val1 > val2 && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold font-mono px-2 py-0.5 rounded uppercase tracking-wider">▲ Supérieur</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 font-sans italic leading-relaxed">
                              {score1?.justification || <span className="text-slate-400">Aucun alignement identifié pour cet objectif.</span>}
                            </p>
                          </div>

                          {/* P2 Column */}
                          <div className={`p-3 rounded-xl border ${val2 > val1 ? "bg-emerald-50/30 border-emerald-500/20" : "bg-[#f8fafc] border-slate-100"}`}>
                            <div className="flex items-center gap-2 mb-1.5 justify-between">
                              <span className={`text-[9px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded ${badge2.bg}`}>
                                Score : {val2 > 0 ? `+${val2}` : val2}
                              </span>
                              {val2 > val1 && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold font-mono px-2 py-0.5 rounded uppercase tracking-wider">▲ Supérieur</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 font-sans italic leading-relaxed">
                              {score2?.justification || <span className="text-slate-400">Aucun alignement identifié pour cet objectif.</span>}
                            </p>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
          })()}
        </main>
      )}

      {/* Corporate compliant Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 h-10 flex items-center justify-between px-6 text-[10px] text-slate-400 font-mono tracking-wider uppercase select-none print:hidden">
        <div>MATRICE ODD BOAD • Version 2.4.1 (UEMOA)</div>
        <div className="flex space-x-6">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#009933] animate-pulse"></span>
            <span>Système opérationnel</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            <span>Gemini 3.5 Flash</span>
          </div>
        </div>
      </footer>
      
      {/* Shared Role-Based Access Control Feedback Toasts */}
      {sessionToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#003366] border-l-4 border-l-[#009933] text-white p-4.5 rounded-lg shadow-2xl flex items-center gap-3 animate-slideIn select-none max-w-sm border border-blue-900">
          <div className="bg-emerald-900/60 p-2 rounded-full">
            <Sparkles className="h-4 w-4 text-emerald-300 animate-pulse" />
          </div>
          <div className="flex-1 text-[11px] font-medium leading-relaxed font-sans">{sessionToast}</div>
          <button 
            type="button" 
            onClick={() => setSessionToast(null)}
            className="text-white/60 hover:text-white font-mono text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

    </div>
  );
}
