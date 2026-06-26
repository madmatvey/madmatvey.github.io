#!/usr/bin/env ruby
# frozen_string_literal: true

# Audits post front matter for SEO length limits.
# Usage: ruby tools/audit_seo_front_matter.rb [path/to/post.md ...]
#
# Exit 0 when every checked post has title and description within limits.
# Exit 1 on violations.

require 'yaml'
require 'date'

ROOT = File.expand_path('..', __dir__)
POSTS_DIR = File.join(ROOT, '_posts')

TITLE_MIN = 20
TITLE_MAX = 70
DESCRIPTION_MAX = 170

def front_matter(path)
  text = File.read(path)
  return {} unless text.start_with?("---\n")

  block = text.split(/^---\n/, 3)[1]
  return {} unless block

  YAML.safe_load(block, permitted_classes: [Date, Time], aliases: true) || {}
rescue Psych::SyntaxError
  {}
end

def check_post(path)
  meta = front_matter(path)
  slug = File.basename(path, '.md').sub(/\A\d{4}-\d{2}-\d{2}-/, '')
  title = meta['title'].to_s
  description = meta['description'].to_s

  issues = []
  issues << "missing title" if title.strip.empty?
  issues << "missing description" if description.strip.empty?

  title_len = title.length
  if title_len.positive? && (title_len < TITLE_MIN || title_len > TITLE_MAX)
    issues << "title length #{title_len} (want #{TITLE_MIN}-#{TITLE_MAX}): #{title.inspect}"
  end

  description_len = description.length
  if description_len > DESCRIPTION_MAX
    issues << "description length #{description_len} (max #{DESCRIPTION_MAX}): #{description.inspect}"
  end

  { slug: slug, path: path, issues: issues }
end

paths = ARGV.empty? ? Dir.glob(File.join(POSTS_DIR, '*.md')).sort : ARGV
errors = paths.flat_map { |path| check_post(path) }.select { |result| result[:issues].any? }

if errors.any?
  puts "SEO front matter errors (#{errors.size}):\n"
  errors.each do |result|
    puts "  #{result[:slug]} (#{result[:path]})"
    result[:issues].each { |issue| puts "    - #{issue}" }
  end
  exit 1
end

puts "SEO front matter OK (#{paths.size} post#{'s' unless paths.size == 1})."
exit 0
