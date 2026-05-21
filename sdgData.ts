/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SdgScore {
  score: number; // -1, 0, 1, 2, 3
  justification: string;
}

export interface SdgAnalysisResult {
  [key: string]: any; // odd1, odd2, ..., odd17
  // we can also represent them explicitly:
  odd1: SdgScore;
  odd2: SdgScore;
  odd3: SdgScore;
  odd4: SdgScore;
  odd5: SdgScore;
  odd6: SdgScore;
  odd7: SdgScore;
  odd8: SdgScore;
  odd9: SdgScore;
  odd10: SdgScore;
  odd11: SdgScore;
  odd12: SdgScore;
  odd13: SdgScore;
  odd14: SdgScore;
  odd15: SdgScore;
  odd16: SdgScore;
  odd17: SdgScore;
  odd_principaux: number[]; // e.g. [1, 2, 3]
  resume_global: string;
}

export interface Project {
  id: string;
  titre: string;
  description: string;
  secteur: string;
  pays: string;
  montant: string; // amount as a raw text representation or parsed string
  createdAt: string;
  analysis?: SdgAnalysisResult;
  indicators?: string; // Follow-up indicators (e.g., "5 000 maraîchers soutenus")
  overrides?: OverrideLog[];
}

export interface OverrideLog {
  id: string;
  sdgId: number;
  oldScore: number;
  newScore: number;
  reason: string;
  author: string;
  timestamp: string;
}

export interface SdgDefinition {
  id: number;
  numberStr: string; // e.g. "01"
  title: string;
  shortTitle: string;
  description: string;
  color: string; // The official SDG color code
  bgClass: string; // Tailwind bg class
  textClass: string; // Tailwind text class
}

export type UserRole = "ANALYSTE" | "MANAGER";

export interface UserSession {
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatarInitials: string;
}

