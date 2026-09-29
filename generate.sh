#!/bin/bash

set -m

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$script_dir/.env" ]; then
  set -a
  source "$script_dir/.env"
  set +a
fi

target="${1:-$ROOT}"

rm -Rf static-export
rm resah.zip
npm run dev > logRunDev.txt &
dev_pid=$!
trap 'kill -- -"$dev_pid" 2>/dev/null' EXIT

until curl -s -o /dev/null http://localhost:3000/; do
  sleep 1
done

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

if [ -z "$target" ]; then
  echo "Usage: $0 <folder-to-copy> (or set ROOT in .env)" >&2
  exit 1
fi

mkdir -p static-export/wp-content/uploads

# base image names referenced by the site, extracted from tmp/http-requests.json
missing_images=(
  1.3.png
  2.1.png
  2.3.png
  3.1.png
  3.2.png
  3.3.png
  4.1.png
  4.3.png
  5.1.png
  5.3.png
  5fnmwej4taa.jpg
  "Nous rejoindre.webp"
  "Toujours %C3%A0 votre %C3%A9coute.jpeg"
  abgavhjxwdq.jpg
  achat-logistique-info-logo.png
  achat-logistique.info.jpg
  actualite-arriere-plan.jpg
  autoevaluation-vert.svg
  blog-orange.svg
  certificaiton-vert.svg
  chaine-rose.svg
  chevron-down.svg
  espace-acheteur-blanc-fond-transparent-v2-768x147.png.webp
  espace-acheteur.jpg
  espace-formation-blanc-fond-transparent-v2-768x147.png.webp
  espace-fournisseur-blanc-fond-transparent-v2-768x147.png.webp
  event-1.jpg
  guide-orange.svg
  jimmy-chang-act8ycszpde-unsplash.jpg
  journaliste-orange.svg
  label-rfar2.png
  logo-ehppa.jpg
  logo-label-rfar.jpeg
  loupe-rose.svg
  portefeuille.png
  projets-ensemble-rose.svg
  qckxruozjrg.jpg
  resah-eco-partenaires-insti.jpg
  resah-eco-partenaires.jpg
  resah-favicon.png
  resah-icone-feuille-rose.svg
  resah-icone-fusee-bleu.svg
  resah_icone_agents_2.png
  resah_icone_chrono-1.png
  resah_icone_echanges.png
  resah_icone_familles_achat.png
  resah_icone_foule.png
  resah_icone_foule2.png
  resah_icone_interface.png
  resah_icone_marches.png
  resah_icone_poignee_mains.png
  resah_icone_reseau_2.png
  resah_logoblanc_rvb.png
  resah_logobleu_rvb_trans.png
  satisfaction-vert.svg
)

# for each base name, copy the exact file plus any -WIDTHxHEIGHT/-scaled size variant
shopt -s nullglob
for image in "${missing_images[@]}"; do
  name="${image%.*}"
  ext="${image##*.}"
  for match in "$target/wp-content/uploads/$image" "$target/wp-content/uploads/$name"-[0-9]*x[0-9]*."$ext" "$target/wp-content/uploads/$name-scaled.$ext"; do
    [ -f "$match" ] && cp "$match" static-export/wp-content/uploads/
  done
done
shopt -u nullglob
cp -R public/assets/ static-export/assets

zip -r resah.zip static-export

echo "WARNING: run 'npm run preview' and check the export for missing images before deploying." >&2

