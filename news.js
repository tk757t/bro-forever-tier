// Version du site et nouveautés affichées dans la fenêtre « Nouveautés » (la plus récente en premier).
// Règle de version :
//  - petit changement ou correction : seulement +0.0.1 sur TIER_VERSION (aucune entrée, aucun pop-up) ;
//  - vraie nouveauté : nouvelle version x.y.0 + une entrée en HAUT de TIER_NEWS (le pop-up s'ouvre alors une fois pour chaque membre).
window.TIER_VERSION = "1.7.3";
window.TIER_NEWS = [
  {
    v: "1.7.0", date: "22/11/2026", title: "Chaîne de quêtes détaillée",
    items: [
      { t: "📖 Clique sur une étape pour la dérouler", d: "Texte officiel de la quête (Wowhead Forever, en français) adapté à ta classe et à ta faction, objets à apporter, lieu, échange des pièces T0 → T0.5 et astuces." },
      { t: "☑ Case à cocher séparée", d: "La case à gauche marque l'étape comme terminée ; un clic ailleurs sur l'étape déroule ou replie son détail." },
      { t: "✅ 3e seigneur du feu confirmé", d: "L'étape « Les trois rois des flammes » demande la Cendre d'Asharell : la contradiction entre les guides est levée." },
    ],
  },
  {
    v: "1.6.0", date: "22/11/2026", title: "Alerte de mise à jour",
    items: [
      { t: "🔔 Nouvelle version disponible", d: "Si tu gardes le site ouvert, une petite bulle te prévient dès qu'une mise à jour est en ligne, avec un bouton pour recharger (ta progression est sauvegardée avant)." },
      { t: "✨ Nouveautés et version", d: "Cette fenêtre s'ouvre à chaque mise à jour. Le numéro de version et le lien « Nouveautés » sont en bas de page." },
    ],
  },
  {
    v: "1.5.0", date: "22/11/2026", title: "Profil, BiS et nouveau look",
    items: [
      { t: "👤 Nouvelle page Profil", d: "Gère tous tes personnages au même endroit : ajoute-en, passe de l'un à l'autre et indique la spécialisation de chacun (les BiS en dépendent)." },
      { t: "⚔ Page BiS", d: "Les meilleurs objets de chaque emplacement selon ta spécialisation, avec leurs alternatives. Coche-les au fur et à mesure." },
      { t: "🎭 Portraits de classe", d: "L'icône de ta classe s'affiche à côté de ton nom, dans le classement et sur les fiches." },
      { t: "🧭 Menu à gauche", d: "Navigation en colonne avec icônes, et un design plus clair et plus lisible." },
      { t: "🏆 Fiches du classement", d: "Clique sur un pseudo du classement pour voir la progression d'un membre." },
    ],
  },
];
