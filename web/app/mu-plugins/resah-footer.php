<?php
/**
 * Plugin Name: Resah Footer
 * Description: Sitewide footer sitemap columns, built to reproduce the original resah.fr footer structure
 * (6 columns + logo/social row + copyright bar) without Astra Pro / a footer builder plugin.
 */

defined('ABSPATH') || exit;

add_action('astra_footer_content_top', function () {
    $columns = [
        'Qui sommes-nous ?' => [
            'Présentation du Resah'                       => '/qui-sommes-nous/presentation-du-resah/',
            "L'équipe"                                     => '/qui-sommes-nous/lequipe/',
            'Nos membres'                                  => '/qui-sommes-nous/nos-membres/',
            'Responsabilité Sociale des Organisations'     => '/qui-sommes-nous/responsabilite-sociale-des-organisations-rso/',
            'Europe'                                       => '/qui-sommes-nous/europe/',
        ],
        'Pratique' => [
            'Nous contacter'  => '/contact/',
            'Adhérer au Resah' => '/#',
            'Espace Presse'   => '/espace-presse/',
        ],
        "Centrale d'Achat" => [
            "Présentation de la centrale d'achat"       => '/centrale-dachat/presentation-de-la-centrale-dachat/',
            'Vous êtes acheteur ?'                       => '/centrale-dachat/vous-etes-acheteur/',
            'Vous êtes fournisseur ?'                    => '/centrale-dachat/vous-etes-fournisseur/',
            "Centre de l'innovation par les achats"      => '/centrale-dachat/le-centre-de-linnovation-par-les-achats/',
        ],
        'Carrière' => [
            'Recrutement, culture et valeurs' => 'https://www.welcometothejungle.com/fr/companies/resah',
            "Offres d'emploi"                 => 'https://www.welcometothejungle.com/fr/companies/resah/jobs',
        ],
        "Centre de ressources et d'expertise" => [
            "Guichet de l'acheteur hospitalier responsable" => '/centre-de-ressources-et-d-expertise/guichet/',
            'Formation'    => '/centre-de-ressources-et-d-expertise/formation/',
            'Publications' => '/centre-de-ressources-et-d-expertise/publications/',
            'Mise en réseau' => '/centre-de-ressources-et-d-expertise/mise-en-reseau/',
            'Appui'         => '/centre-de-ressources-et-d-expertise/appui/',
            'Digitalisation' => '/centre-de-ressources-et-d-expertise/digitalisation/',
        ],
        'Communication' => [
            'Agenda des événements' => '/agenda/',
            'Actualités'            => '/actualites/',
            'Replays des conférences' => '/#',
        ],
    ];
    ?>
    <div class="resah-footer-columns">
        <?php foreach ($columns as $title => $links) : ?>
            <div class="resah-footer-col">
                <h4><?php echo esc_html($title); ?></h4>
                <ul>
                    <?php foreach ($links as $label => $url) :
                        $is_external = strpos($url, 'http') === 0;
                        $href = $is_external ? $url : home_url($url);
                        ?>
                        <li>
                            <a href="<?php echo esc_url($href); ?>"<?php echo $is_external ? ' target="_blank" rel="noopener"' : ''; ?>>
                                <?php echo esc_html($label); ?>
                            </a>
                        </li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endforeach; ?>
    </div>

    <div class="resah-footer-brand">
        <a href="<?php echo esc_url(home_url('/')); ?>">
            <img src="<?php echo esc_url(content_url('uploads/2026/09/logo-footer.png')); ?>" alt="Resah" width="150" height="69">
        </a>
        <div class="resah-footer-social">
            <a href="https://fr.linkedin.com/company/resah" target="_blank" rel="noopener" aria-label="LinkedIn">in</a>
            <a href="https://www.youtube.com/channel/UCfGCEqOizEJ6oBr0RuCDy7w" target="_blank" rel="noopener" aria-label="YouTube">&#9654;</a>
        </div>
    </div>
    <?php
});

add_action('astra_footer_content_bottom', function () {
    ?>
    <div class="resah-footer-bottom">
        <span>&copy; Réseau des Acheteurs Hospitaliers - Tous droits réservés</span>
        <span class="resah-footer-bottom__links">
            <a href="<?php echo esc_url(home_url('/mentions-legales/')); ?>">Mentions légales</a>
            <a href="<?php echo esc_url(home_url('/donnees-personnelles/')); ?>">Politique de confidentialité</a>
            <a href="<?php echo esc_url(home_url('/politique-de-cookies-ue/')); ?>">Cookies</a>
        </span>
    </div>
    <?php
});

add_action('wp_enqueue_scripts', function () {
    $css = '
.resah-footer-columns{display:grid;grid-template-columns:repeat(3,1fr);gap:32px 24px;padding:48px 20px 32px;max-width:1200px;margin:0 auto}
@media(max-width:900px){.resah-footer-columns{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.resah-footer-columns{grid-template-columns:1fr}}
.resah-footer-columns h4{color:#7FCEF4;font-size:.95rem;text-transform:uppercase;margin-bottom:12px}
.resah-footer-columns ul{list-style:none;margin:0;padding:0}
.resah-footer-columns li{margin-bottom:8px}
.resah-footer-columns a{color:#FFFFFF;text-decoration:none;font-size:.9rem}
.resah-footer-columns a:hover{text-decoration:underline}
.resah-footer-brand{max-width:1200px;margin:0 auto;padding:24px 20px;border-top:1px solid rgba(255,255,255,.15);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
.resah-footer-social{display:flex;gap:12px}
.resah-footer-social a{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:.85rem}
.resah-footer-social a:hover{background:rgba(255,255,255,.25)}
.resah-footer-bottom{max-width:1200px;margin:0 auto;padding:16px 20px 32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;color:rgba(255,255,255,.8);font-size:.8rem}
.resah-footer-bottom__links a{color:rgba(255,255,255,.8);text-decoration:none;margin-left:16px}
.resah-footer-bottom__links a:hover{text-decoration:underline}
';
    wp_register_style('resah-footer', false);
    wp_enqueue_style('resah-footer');
    wp_add_inline_style('resah-footer', $css);
});
