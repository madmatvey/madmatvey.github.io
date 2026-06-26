#!/usr/bin/env ruby
# frozen_string_literal: true

# Audits cluster hub config against published posts.
# Usage: ruby tools/audit_clusters.rb
#
# Exit 0 when every post category maps to clusters.yml and curated slugs exist.
# Exit 1 on missing cluster entries or missing post files.

require 'yaml'
require 'date'

ROOT = File.expand_path('..', __dir__)
POSTS_DIR = File.join(ROOT, '_posts')
CLUSTERS_PATH = File.join(ROOT, '_data/clusters.yml')
PERSONAL_CATEGORY = 'Personal'

def post_meta(path)
  slug = File.basename(path, '.md').sub(/\A\d{4}-\d{2}-\d{2}-/, '')
  front = File.read(path).split(/^---\n/, 3)[1] || ''
  date_line = front[/^date:\s*(.+)$/i, 1]
  file_date = File.basename(path)[/\A(\d{4}-\d{2}-\d{2})/, 1]
  raw = (date_line || file_date).to_s.strip
  published_on = Date.parse(raw.split(/\s+/).first)
  categories = front.scan(/^categories:\s*\[([^\]]+)\]/).flatten.first.to_s
                    .split(',').map { |c| c.strip.delete('"') }.reject(&:empty?)
  { slug: slug, path: path, published_on: published_on, categories: categories }
rescue Date::Error
  { slug: slug, path: path, published_on: nil, categories: [] }
end

posts = Dir.glob(File.join(POSTS_DIR, '*.md')).map { |p| post_meta(p) }
by_slug = posts.to_h { |p| [p[:slug], p] }
today = Date.today
clusters = YAML.load_file(CLUSTERS_PATH)

errors = []
warnings = []

def collect_slugs(cluster)
  slugs = []
  cluster['featured']&.each { |item| slugs << (item.is_a?(Hash) ? item['slug'] : item) }
  slugs << cluster.dig('foundational', 'slug')
  cluster['problems']&.each { |item| slugs << item['slug'] }
  cluster['related']&.each { |item| slugs << (item.is_a?(Hash) ? item['slug'] : item) }
  slugs.compact.uniq
end

clusters.each do |category, config|
  %w[slug title].each do |key|
    errors << "clusters.yml[#{category}] missing #{key}" if config[key].to_s.strip.empty?
  end

  collect_slugs(config).each do |slug|
    meta = by_slug[slug]
    unless meta
      errors << "clusters.yml curated slug not found in _posts/: #{slug} (#{category})"
      next
    end

    next unless meta[:published_on] && meta[:published_on] > today

    warnings << "scheduled (not live until #{meta[:published_on]}): #{slug} (#{category})"
  end
end

posts.each do |post|
  primary = post[:categories].first
  next if primary.nil? || primary.empty?
  next if primary == PERSONAL_CATEGORY

  unless clusters.key?(primary)
    errors << "post category has no cluster hub: #{post[:slug]} → #{primary}"
  end
end

if warnings.any?
  puts "Warnings (#{warnings.size}):\n"
  warnings.each { |w| puts "  - #{w}" }
  puts
end

if errors.any?
  puts "Errors (#{errors.size}):\n"
  errors.each { |e| puts "  - #{e}" }
  exit 1
end

puts 'Cluster config OK.'
exit 0
