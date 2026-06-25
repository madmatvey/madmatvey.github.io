#!/usr/bin/env ruby
# frozen_string_literal: true

require 'fileutils'

POSTS_DIR = File.expand_path('../_posts', __dir__)

CATEGORY_MAP = {
  'how-we-reduced-postgresql-query-time-from-250ms-to-20ms' => 'PostgreSQL Performance',
  'the-index-lie-why-just-add-an-index-can-make-your-query-slower' => 'PostgreSQL Performance',
  'stop-reading-explain-analyze-start-cross-examining-it' => 'PostgreSQL Performance',
  'sql-optimization-or-criminal-tracking' => 'PostgreSQL Performance',
  'redis-is-single-threaded' => 'Backend Engineering',
  'most-engineers-review-code-staff-engineers-review-decisions' => 'Backend Engineering',
  'the-ai-model-is-no-longer-the-bottleneck' => 'Backend Engineering',
  'the-memory-problem-nobody-is-solving' => 'Backend Engineering',
  'ai-junior' => 'Backend Engineering',
  'ai-assited-coding-statement' => 'Backend Engineering',
  'tars-prompting' => 'Backend Engineering',
  'ai-system-linkedin-content-analysis' => 'Backend Engineering',
  'the-biggest-engineering-wins-were-things-we-didnt-build' => 'Architecture',
  'product-minded-engineer' => 'Architecture',
  'the-level-3-trap-eight-levels-of-product-minded-engineering' => 'Architecture',
  'sailing-through-product-development' => 'Architecture',
  'ux-when-initial-app-loading' => 'Architecture',
  'leadership-hats' => 'Engineering Leadership',
  'the-hat-technical-leaders-refuse-to-wear' => 'Engineering Leadership',
  'from-senior-engineer-to-cto-the-real-skill-gap-isnt-technical' => 'Engineering Leadership',
  'the-man-who-killed-google' => 'Engineering Leadership',
  'constuctive-feedback' => 'Engineering Leadership',
  'top-five-books-for-engineering-leaders' => 'Engineering Leadership',
  'real-driver-of-quality-hiring' => 'Engineering Leadership',
  'human-problem-solving' => 'Engineering Leadership',
  'startups-will-die' => 'Engineering Leadership',
  'looking-for-my-next-role' => 'Engineering Leadership',
  'your-billing-system-probably-isnt-an-accounting-system' => 'Billing & Fintech',
  'introducing-ruby-gasless-sdk' => 'Billing & Fintech',
  'what-is-entp-and-mbti' => 'Personal',
  'ikigai' => 'Personal',
  'imposter-syndrome' => 'Personal',
  'russian-programmer-way' => 'Personal',
  'about' => 'Personal',
  'crypto-wallet-basic-security' => 'Personal',
  'recruiter-hacker' => 'Personal'
}.freeze

LEGACY_SLUGS = %w[
  what-is-entp-and-mbti
  ikigai
  imposter-syndrome
  russian-programmer-way
  about
  crypto-wallet-basic-security
  recruiter-hacker
].freeze

def slug_from_filename(filename)
  basename = File.basename(filename, '.md')
  basename.sub(/\A\d{4}-\d{2}-\d{2}-/, '')
end

def date_from_filename(filename)
  basename = File.basename(filename, '.md')
  basename.match(/\A(\d{4}-\d{2}-\d{2})-/)[1]
end

Dir.glob(File.join(POSTS_DIR, '*.md')).each do |path|
  slug = slug_from_filename(path)
  category = CATEGORY_MAP[slug]
  unless category
    warn "No category mapping for #{slug}"
    next
  end

  content = File.read(path)
  date = date_from_filename(path)
  y, m, d = date.split('-')
  legacy_path = "/#{y}/#{m}/#{d}/#{slug}/"
  legacy_html = "/#{y}/#{m}/#{d}/#{slug}.html"

  content = content.gsub(/^categories:.*$/, "categories: [#{category}]")

  unless content.include?('redirect_from:')
    redirect_block = <<~YAML
      redirect_from:
        - #{legacy_path}
        - #{legacy_html}
    YAML
    content = content.sub(/\A(---\n.*?\n)(?!redirect_from)/m) { "#{Regexp.last_match(1)}#{redirect_block}" }
  end

  if LEGACY_SLUGS.include?(slug) && !content.match?(/^exclude_from_trending:/)
    content = content.sub(/^categories:.*\n/) { |m| "#{m}exclude_from_trending: true\n" }
  end

  File.write(path, content)
  puts "Updated #{slug} -> #{category}"
end
