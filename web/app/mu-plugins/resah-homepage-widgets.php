<?php
/**
 * Plugin Name: Resah Homepage Dynamic Widgets
 * Description: Shortcodes powering the homepage "Dernieres nouvelles" and events teaser grids.
 */

defined('ABSPATH') || exit;

add_shortcode('resah_latest_news', function ($atts) {
    $atts = shortcode_atts(['count' => 6, 'category' => 'actualites'], $atts);

    $query = new WP_Query([
        'post_type'      => 'post',
        'post_status'    => 'publish',
        'category_name'  => $atts['category'],
        'posts_per_page' => (int) $atts['count'],
        'orderby'        => 'date',
        'order'          => 'DESC',
        'no_found_rows'  => true,
    ]);

    if (!$query->have_posts()) {
        return '';
    }

    ob_start();
    echo '<div class="resah-news-grid">';
    while ($query->have_posts()) {
        $query->the_post();
        ?>
        <article class="resah-news-card">
            <a href="<?php the_permalink(); ?>" class="resah-news-card__link">
                <?php if (has_post_thumbnail()) : ?>
                    <div class="resah-news-card__image">
                        <?php the_post_thumbnail('medium_large'); ?>
                    </div>
                <?php endif; ?>
                <div class="resah-news-card__body">
                    <span class="resah-news-card__date"><?php echo esc_html(get_the_date('d.m.Y')); ?></span>
                    <h3 class="resah-news-card__title"><?php the_title(); ?></h3>
                    <p class="resah-news-card__excerpt"><?php echo esc_html(wp_trim_words(get_the_excerpt(), 20)); ?></p>
                </div>
            </a>
        </article>
        <?php
    }
    echo '</div>';
    wp_reset_postdata();

    return ob_get_clean();
});

add_shortcode('resah_upcoming_events', function ($atts) {
    if (!function_exists('tribe_get_events')) {
        return '';
    }
    $atts = shortcode_atts(['count' => 4], $atts);

    $events = tribe_get_events([
        'posts_per_page' => (int) $atts['count'],
        'start_date'     => 'now',
        'order'          => 'ASC',
    ]);

    if (empty($events)) {
        return '';
    }

    ob_start();
    echo '<div class="resah-events-grid">';
    foreach ($events as $event) {
        ?>
        <article class="resah-event-card">
            <a href="<?php echo esc_url(get_permalink($event)); ?>" class="resah-event-card__link">
                <?php if (has_post_thumbnail($event)) : ?>
                    <div class="resah-event-card__image">
                        <?php echo get_the_post_thumbnail($event, 'medium'); ?>
                    </div>
                <?php endif; ?>
                <div class="resah-event-card__body">
                    <span class="resah-event-card__date">
                        <?php echo esc_html(tribe_get_start_date($event, false, 'd M Y')); ?>
                    </span>
                    <h3 class="resah-event-card__title"><?php echo esc_html(get_the_title($event)); ?></h3>
                </div>
            </a>
        </article>
        <?php
    }
    echo '</div>';

    return ob_get_clean();
});

add_action('wp_enqueue_scripts', function () {
    $css = '
.resah-news-grid,.resah-events-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin:24px 0}
@media(max-width:900px){.resah-news-grid,.resah-events-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.resah-news-grid,.resah-events-grid{grid-template-columns:1fr}}
.resah-news-card,.resah-event-card{background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 6px rgba(29,28,29,.12);transition:transform .15s ease}
.resah-news-card:hover,.resah-event-card:hover{transform:translateY(-4px)}
.resah-news-card__link,.resah-event-card__link{display:block;color:inherit;text-decoration:none}
.resah-news-card__image img,.resah-event-card__image img{width:100%;height:180px;object-fit:cover;display:block}
.resah-news-card__body,.resah-event-card__body{padding:16px}
.resah-news-card__date,.resah-event-card__date{color:#7FCEF4;font-weight:700;font-size:.85rem;text-transform:uppercase}
.resah-news-card__title,.resah-event-card__title{color:#3A4A99;font-size:1.1rem;margin:8px 0}
.resah-news-card__excerpt{color:#1D1C1D;font-size:.95rem;line-height:1.4}
';
    wp_register_style('resah-homepage-widgets', false);
    wp_enqueue_style('resah-homepage-widgets');
    wp_add_inline_style('resah-homepage-widgets', $css);
});
