# frozen_string_literal: true

require 'yaml'
require 'date'

module Jekyll
  module LlmVisibility
    # Generate standard .md routes alongside HTML pages
    class MdGenerator < Generator
      safe true
      priority :low

      def generate(site)
        config = site.config['ai_visible_content'] || {}
        return unless config['enabled']

        docs = content_pages(site)
        docs.each do |doc|
          md_path = standard_md_path(doc)
          next unless md_path
          next if md_path == '/.md'

          # Skip if already generated (e.g. by another plugin or duplicate)
          next if site.pages.any? { |p| p.data['permalink'] == md_path && p.is_a?(Jekyll::PageWithoutAFile) }

          content = build_page_markdown_content(doc)
          # Use .txt extension internally so Jekyll doesn't run markdown converter
          internal_name = md_path.sub(%r{^/}, '').tr('/', '_') + '.txt'
          page = Jekyll::PageWithoutAFile.new(site, site.source, '', internal_name)
          page.content = content
          page.data['layout'] = nil
          page.data['sitemap'] = false
          page.data['permalink'] = md_path
          site.pages << page
        end
      end
      
      def content_pages(site)
        docs = site.documents.dup
        page_pages = site.pages.select do |p|
          next false unless p.url
          next false if p.url.start_with?('/assets/')
          next false if %w[.xml .json .md .txt .yml].include?(File.extname(p.url).downcase)
          next false if p.is_a?(Jekyll::PageWithoutAFile)
          true
        end
        docs += page_pages
        docs
      end

      private

      def standard_md_path(doc)
        url = doc.url.to_s
        return '/index.md' if url == '/' || url == '/index.html'
        return nil if url.empty?

        base = url.chomp('/')
        return nil if base.empty?

        ext = File.extname(base)
        if ext.empty?
          "#{base}.md"
        else
          "#{base.chomp(ext)}.md"
        end
      end

      def build_page_markdown_content(doc)
        raw = File.exist?(doc.path) ? File.read(doc.path) : doc.content.to_s
        front_matter, body = extract_front_matter_and_body(raw)
        meta = parse_front_matter_hash(front_matter)
        cleaned_body = strip_liquid_tags(body)
        heading = meta['title'].to_s.strip
        description = meta['description'].to_s.strip
        subtitle = meta['subtitle'].to_s.strip

        lines = []
        lines << "# #{heading}" unless heading.empty?
        lines << ''
        lines << "_#{subtitle}_" unless subtitle.empty?
        lines << '' unless subtitle.empty?
        lines << description unless description.empty?
        lines << '' unless description.empty?
        lines << cleaned_body
        built = lines.join("\n").gsub(/\n{3,}/, "\n\n").strip
        "#{built}\n"
      end

      def extract_front_matter_and_body(raw)
        match = raw.match(/\A---\s*\n(.*?)\n---\s*\n?(.*)\z/m)
        return ['', raw] unless match

        ["#{match[1].rstrip}\n", match[2]]
      end

      def strip_liquid_tags(content)
        cleaned = content.to_s
                         .gsub(/\{%\s*comment\s*%\}.*?\{%\s*endcomment\s*%\}/m, '')
                         .gsub(/\{%-?\s*.*?\s*-?%\}/m, '')
                         .gsub(/\{\{\s*.*?\s*\}\}/m, '')
                         .gsub(/\n{3,}/, "\n\n")
                         .strip
        "#{cleaned}\n"
      end

      def parse_front_matter_hash(front_matter)
        return {} if front_matter.to_s.strip.empty?

        parsed = YAML.safe_load(front_matter, permitted_classes: [Date, Time], aliases: true)
        parsed.is_a?(Hash) ? parsed : {}
      rescue Psych::Exception
          {}
      end
    end

    # Inject <link rel="alternate" type="text/markdown"> into HTML <head>
    class AlternateLinkInjector
      def self.process(doc)
        return unless doc.output_ext == '.html'
        return unless doc.output

        site = doc.site
        config = site.config['ai_visible_content'] || {}
        return unless config['enabled']
        return if doc.is_a?(Jekyll::PageWithoutAFile)

        md_path = standard_md_path(doc)
        return unless md_path

        # Avoid duplicate injection
        return if doc.output.include?('rel="alternate" type="text/markdown"')

        link_tag = %(<link rel="alternate" type="text/markdown" href="#{site.config['url']}#{md_path}">)
        if doc.output.include?('</head>')
          doc.output = doc.output.sub('</head>', "#{link_tag}\n</head>")
        elsif doc.is_a?(Jekyll::Document)
          # post_render for Documents runs before layout rendering; prepend to output
          doc.output = "#{link_tag}\n#{doc.output}"
        end
      end

      def self.standard_md_path(doc)
        url = doc.url.to_s
        return '/index.md' if url == '/' || url == '/index.html'
        return nil if url.empty?

        base = url.chomp('/')
        return nil if base.empty?

        ext = File.extname(base)
        if ext.empty?
          "#{base}.md"
        else
          "#{base.chomp(ext)}.md"
        end
      end
    end

    # Inject visually-hidden Markdown pointer into HTML <body>
    class VisuallyHiddenInjector
      def self.process(doc)
        return unless doc.output_ext == '.html'
        return unless doc.output

        site = doc.site
        config = site.config['ai_visible_content'] || {}
        return unless config['enabled']
        return if doc.is_a?(Jekyll::PageWithoutAFile)

        md_path = standard_md_path(doc)
        return unless md_path

        full_url = "#{site.config['url']}#{md_path}"

        # Avoid duplicate injection
        return if doc.output.include?('A Markdown version of this page is available')

        pointer = <<~HTML
          <div style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;" aria-hidden="true">
            A Markdown version of this page is available at #{full_url}.
          </div>
        HTML

        if doc.output.include?('</body>')
          doc.output = doc.output.sub('</body>', "#{pointer}\n</body>")
        elsif doc.is_a?(Jekyll::Document)
          # post_render for Documents runs before layout rendering; append to output
          doc.output = "#{doc.output}#{pointer}\n"
        end
      end

      def self.standard_md_path(doc)
        url = doc.url.to_s
        return '/index.md' if url == '/' || url == '/index.html'
        return nil if url.empty?

        base = url.chomp('/')
        return nil if base.empty?

        ext = File.extname(base)
        if ext.empty?
          "#{base}.md"
        else
          "#{base.chomp(ext)}.md"
        end
      end
    end
  end
end

Jekyll::Hooks.register(:pages, :post_render) { |page| Jekyll::LlmVisibility::AlternateLinkInjector.process(page) }
Jekyll::Hooks.register(:documents, :post_render) { |doc| Jekyll::LlmVisibility::AlternateLinkInjector.process(doc) }
Jekyll::Hooks.register(:pages, :post_render) { |page| Jekyll::LlmVisibility::VisuallyHiddenInjector.process(page) }
Jekyll::Hooks.register(:documents, :post_render) { |doc| Jekyll::LlmVisibility::VisuallyHiddenInjector.process(doc) }

# Ensure llms.txt and llms-full.txt are included in sitemap
Jekyll::Hooks.register(:site, :post_render) do |site|
  %w[llms.txt llms-full.txt].each do |name|
    page = site.pages.find { |p| p.path == name || p.data['permalink'] == "/#{name}" }
    next unless page
    page.data['sitemap'] = true
    page.data['last_modified_at'] = site.time if page.data['last_modified_at'].nil?
  end
end
