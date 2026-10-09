<?php

$json = json_decode(file_get_contents('page.json'), true);

$post_id = wp_insert_post([
    'post_type'   => 'page',
    'post_title'  => $json['title']['rendered'],
    'post_name'   => $json['slug'],
    'post_status' => 'publish',
]);

update_post_meta(
    $post_id,
    '_elementor_data',
    $json['spectra_custom_meta']['_elementor_data'][0]
);

update_post_meta(
    $post_id,
    '_elementor_edit_mode',
    'builder'
);

update_post_meta(
    $post_id,
    '_elementor_version',
    '3.13.1'
);

echo "Page créée : $post_id\n";