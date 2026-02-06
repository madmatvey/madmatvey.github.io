#!/usr/bin/env ruby
#
# Add lastmod dates to all pages for sitemap.xml
# This ensures all URLs in sitemap have lastmod dates
#
# Works with jekyll-archives plugin to add lastmod to tag and category pages

module Jekyll
  class SitemapLastmodGenerator < Generator
    safe true
    priority :lowest # Run after jekyll-archives

    def generate(site)
      # Add lastmod to tag pages based on latest post date
      if site.respond_to?(:tags) && site.tags
        site.tags.each do |tag_name, posts|
          next if posts.empty?
          
          # Find the most recent post date for this tag
          latest_date = posts.map do |post|
            post.data['last_modified_at'] || post.date || site.time
          end.max
          
          # Find the tag page (jekyll-archives creates these)
          tag_url = "/tags/#{tag_name}/"
          tag_page = site.pages.find { |p| p.url == tag_url }
          if tag_page
            tag_page.data['last_modified_at'] = latest_date
          end
        end
      end
      
      # Add lastmod to category pages based on latest post date
      if site.respond_to?(:categories) && site.categories
        site.categories.each do |category_name, posts|
          next if posts.empty?
          
          # Find the most recent post date for this category
          latest_date = posts.map do |post|
            post.data['last_modified_at'] || post.date || site.time
          end.max
          
          # Find the category page (jekyll-archives creates these)
          category_url = "/categories/#{category_name}/"
          category_page = site.pages.find { |p| p.url == category_url }
          if category_page
            category_page.data['last_modified_at'] = latest_date
          end
        end
      end
      
      # Set lastmod for main pages that don't have it
      site.pages.each do |page|
        next if page.data['last_modified_at']
        
        # For index/home page
        if page.url == '/' || page.url == '/index.html'
          # Use the date of the most recent post
          latest_post = site.posts.docs.max_by { |post| post.date || site.time }
          if latest_post
            page.data['last_modified_at'] = latest_post.data['last_modified_at'] || latest_post.date
          else
            page.data['last_modified_at'] = site.time
          end
        # For pagination pages
        elsif page.url.start_with?('/page')
          latest_post = site.posts.docs.max_by { |post| post.date || site.time }
          if latest_post
            page.data['last_modified_at'] = latest_post.data['last_modified_at'] || latest_post.date
          else
            page.data['last_modified_at'] = site.time
          end
        # For other pages, use file modification time or site time
        elsif page.path && File.exist?(page.path)
          page.data['last_modified_at'] = File.mtime(page.path)
        else
          page.data['last_modified_at'] = site.time
        end
      end
    end
  end
end
