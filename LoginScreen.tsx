/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Globe, FileText, Activity, LogOut, User } from "lucide-react";
import boadLogo from "../assets/images/boad_logo_1779359066376.png";

interface HeaderProps {
  userEmail?: string | null;
  userDisplayName?: string | null;
  onLogout?: () => void;
}

export default function Header({ userEmail, userDisplayName, onLogout }: HeaderProps) {
  const displayName = userDisplayName || (userEmail ? userEmail.split("@")[0] : "Analyste");

  return (
    <header className="bg-slate-55/90 bg-slate-50 text-slate-800 shadow-sm border-b-4 border-[#009933]">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between py-5 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1 rounded-lg shadow-inner flex items-center justify-center border border-[#009933]">
              <img
                src={boadLogo}
                alt="BOAD Logo"
                id="boad-logo-icon"
                className="h-10 w-10 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-2xl font-sans font-extrabold tracking-tight text-[#003366]" id="main-title">
                BOAD Matrice ODD
              </h1>
              <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
                Outil Interne d'Évaluation de l'Impact et d'Alignement des Projets sur les ODD de l'ONU
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 self-stretch md:self-auto justify-end">
            <div className="flex items-center gap-4 text-xs text-slate-700 font-mono bg-slate-200/50 px-4 py-2.5 rounded-lg border border-slate-300 justify-around">
              <div className="flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-[#009933]" />
                <span className="hidden sm:inline">8 États Membres</span>
                <span className="sm:hidden">8 ÉM</span>
              </div>
              <div className="h-4 w-[1px] bg-slate-300"></div>
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>ODD v2.1</span>
              </div>
              <div className="h-4 w-[1px] bg-slate-300 font-light"></div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-orange-600 animate-pulse" />
                <span className="hidden sm:inline">Scoring Gemini Active</span>
                <span className="sm:hidden">Gemini</span>
              </div>
            </div>

            {userEmail && (
              <div className="flex items-center gap-3 bg-slate-200/50 px-3 py-1.5 rounded-lg border border-slate-300">
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-6 w-6 rounded-full bg-[#009933]/90 text-white font-sans font-bold flex items-center justify-center uppercase shadow-xs">
                    {displayName.charAt(0)}
                  </div>
                  <span className="font-semibold text-slate-700 truncate max-w-[120px]" title={userEmail}>
                    {displayName}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-1 rounded-md text-red-600 hover:text-red-800 hover:bg-slate-300/50 transition cursor-pointer select-none"
                    title="Se déconnecter"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
