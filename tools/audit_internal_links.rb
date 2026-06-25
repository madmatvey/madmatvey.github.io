#!/usr/bin/env ruby
# frozen_string_literal: true

# Audits manual /posts/ cross-links within content clusters.
# Usage: ruby tools/audit_internal_links.rb

require 'yaml'

ROOT = File.expand_path('..', __dir__)
POSTS_DIR = File.join(ROOT, '_posts')
CLUSTERS_PATH = File.join(ROOT, '_data/content_clusters.yml')

clusters = YAML.load_file(CLUSTERS_PATH)
posts_by_slug = {}

Dir.glob(File.join(POSTS_DIR, '*.md')).each do |path|
  slug = File.basename(path, '.md').sub(/\A\d{4}-\d{2}-\d{2}-/, '')
  body = File.read(path).split(/^---\n/, 3)[2] || ''
  links = body.scan(%r{\(/posts/([a-z0-9-]+)/?\)}).flatten.uniq
  posts_by_slug[slug] = links
end

gaps = []

clusters.each do |cluster_name, slugs|
  slugs.each do |slug|
    next unless posts_by_slug.key?(slug)

    peers = slugs - [slug]
    linked = posts_by_slug[slug]
    missing = peers.reject { |peer| linked.include?(peer) }

    next if missing.empty?

    gaps << { cluster: cluster_name, post: slug, missing: missing }
  end
end

if gaps.empty?
  puts 'All cluster peers are cross-linked.'
else
  puts "Found #{gaps.size} post(s) with missing cluster links:\n\n"
  gaps.each do |g|
    puts "[#{g[:cluster]}] #{g[:post]}"
    g[:missing].each { |m| puts "  -> missing link to #{m}" }
    puts
  end
  exit 1
end
