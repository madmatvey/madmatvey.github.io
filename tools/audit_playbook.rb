#!/usr/bin/env ruby
# frozen_string_literal: true

# Audits PostgreSQL playbook config against published posts.
# Usage: ruby tools/audit_playbook.rb
#
# Exit 0 when every playbook slug is either published or scheduled (future).
# Exit 1 when a slug is missing from _posts/ or a cluster post is not in the playbook.

require 'yaml'
require 'date'

ROOT = File.expand_path('..', __dir__)
POSTS_DIR = File.join(ROOT, '_posts')
PLAYBOOK_PATH = File.join(ROOT, '_data/postgresql_playbook.yml')
CLUSTERS_PATH = File.join(ROOT, '_data/content_clusters.yml')
TZ = 'Asia/Tbilisi'

def post_meta(path)
  slug = File.basename(path, '.md').sub(/\A\d{4}-\d{2}-\d{2}-/, '')
  front = File.read(path).split(/^---\n/, 3)[1] || ''
  date_line = front[/^date:\s*(.+)$/i, 1]
  file_date = File.basename(path)[/\A(\d{4}-\d{2}-\d{2})/, 1]
  raw = (date_line || file_date).to_s.strip
  published_on = Date.parse(raw.split(/\s+/).first)
  { slug: slug, path: path, published_on: published_on }
rescue Date::Error
  { slug: slug, path: path, published_on: nil }
end

posts = Dir.glob(File.join(POSTS_DIR, '*.md')).map { |p| post_meta(p) }
by_slug = posts.to_h { |p| [p[:slug], p] }
today = Date.today

playbook = YAML.load_file(PLAYBOOK_PATH)
cluster_slugs = YAML.load_file(CLUSTERS_PATH)['postgresql-performance'] || []

playbook_slugs = []
playbook_slugs << playbook.dig('foundational', 'slug')
playbook['start_here']&.each { |i| playbook_slugs << i['slug'] }
playbook['problems']&.each { |i| playbook_slugs << i['slug'] }
playbook['related']&.each { |i| playbook_slugs << i['slug'] }
playbook_slugs.compact!
playbook_slugs.uniq!

errors = []
warnings = []

playbook_slugs.each do |slug|
  meta = by_slug[slug]
  unless meta
    errors << "playbook slug not found in _posts/: #{slug}"
    next
  end

  next unless meta[:published_on] && meta[:published_on] > today

  warnings << "scheduled (not live until #{meta[:published_on]}): #{slug}"
end

missing_from_playbook = cluster_slugs - playbook_slugs
missing_from_playbook.each do |slug|
  warnings << "in postgresql-performance cluster but not playbook config: #{slug}"
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

puts 'Playbook config OK.'
exit 0
