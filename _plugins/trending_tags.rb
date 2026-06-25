# frozen_string_literal: true

# Builds tag frequency counts excluding posts with exclude_from_trending: true.
# Consumed by _includes/trending-tags.html via site.data['trending_tag_counts'].

module Jekyll
  class TrendingTagsGenerator < Generator
    safe true
    priority :lowest

    def generate(site)
      counts = Hash.new(0)
      labels = {}

      site.posts.docs.each do |post|
        next if post.data['exclude_from_trending']

        Array(post.data['tags']).each do |tag|
          key = tag.to_s.downcase.strip
          counts[key] += 1
          labels[key] = tag.to_s.strip
        end
      end

      site.data['trending_tag_counts'] =
        counts
        .sort_by { |_, count| -count }
        .map { |key, count| { 'name' => labels[key], 'count' => count } }
    end
  end
end
