rm -Rf static-export

npm run dev

wget --mirror --page-requisites --adjust-extension --convert-links --no-host-directories --directory-prefix=static-export http://localhost:3000/

rm -Rf static-export/0
rm -Rf static-export/2023
rm -Rf static-export/2024
rm -Rf static-export/2025
rm -Rf static-export/actualites
rm -Rf static-export/agenda
rm -Rf static-export/assets
rm -Rf static-export/author
rm -Rf static-export/base-documentaire
rm -Rf static-export/feed
rm -Rf static-export/feed/index.html
rm -Rf static-export/formulaire-de-prise-de-contact-dune-entreprise-innovante
rm -Rf static-export/Images
rm -Rf static-export/it-le-chu-de-besancon-securise-ses-appros-avec-koesio
rm -Rf static-export/la-semaine-europeenne-du-developpement-durable-avec-le-resah
rm -Rf static-export/le-catalogue-de-formation-2024-est-disponible
rm -Rf static-export/le-resah-lance-un-nouveau-geb-optimiser-les-achats-de-medicaments-et-de-dispositifs-medicaux
rm -Rf static-export/le-resah-presente-le-guichet-de-lacheteur-hospitalier-responsable
rm -Rf static-export/le-resah-propose-une-solution-complete-pour-une-plus-grande-efficacite-energetique
rm -Rf static-export/le-resah-vient-de-publier-un-nouveau-guide-intitule-gestion-des-dasri-pour-un-achat-sans-risque
rm -Rf static-export/les-journees-regionales-du-resah-autonomie-tour
rm -Rf static-export/les-journees-regionales-du-resah-edition-2025-focus-numerique
rm -Rf static-export/les-journees-regionales-du-resah-focus-comment-elaborer-son-spaser
rm -Rf static-export/les-journees-regionales-du-resah-focus-economie-circulaire-et-achats-responsables
rm -Rf static-export/les-journees-regionales-du-resah-focus-medico-social
rm -Rf static-export/les-journees-regionales-du-resah-focus-numerique
rm -Rf static-export/les-journees-regionales-du-resah-focus-performance-globale
rm -Rf static-export/les-journees-regionales-du-resah-focus-performance-globale-acte-ii
rm -Rf static-export/les-journees-regionales-du-resah-les-enjeux-de-la-transformation-numerique
rm -Rf static-export/rapport-dactivite-2022-du-resah-lachat-responsable-au-coeur-de-notre-action
rm -Rf static-export/rapport-dactivite-2022-du-resah-lachat-responsable-au-coeur-de-notre-action/index.html
rm -Rf static-export/rejoignez-le-groupe-detude-et-benchmarking-ameliorer-le-pilotage-de-ses-achats-responsables
rm -Rf static-export/RESAH_INTERNET
rm -Rf static-export/retours-dexperiences
rm -Rf static-export/robots-et-automates-decouvrez-la-publication-anap-x-resah
rm -Rf static-export/sante-achat-info-devient-achat-logistique-info
rm -Rf static-export/Style
rm -Rf static-export/venez-rencontrer-les-equipes-du-resah-a-santexpo-du-20-au-22-mai-a-paris
rm -Rf static-export/venez-rencontrer-les-equipes-du-resah-a-santexpo-du-21-au-23-mai-a-paris

find static-export -type f -name 'index.html?*' -delete

if [ -z "$1" ]; then
  echo "Usage: $0 <folder-to-copy>" >&2
  exit 1
fi

cp -R "$1" static-export/wp-content/uploads
cp -R public/assets/ static-export/assets

zip -r resah.zip static-export

echo "WARNING: run 'npm run preview' and check the export for missing images before deploying." >&2

