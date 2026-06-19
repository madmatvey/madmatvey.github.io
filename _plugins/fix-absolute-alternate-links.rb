# frozen_string_literal: true

module Jekyll
  module AbsoluteAlternateLinks
    RELATIVE_LINK_PATTERN = %r{
      <link\s+rel="(alternate|ai:markdown)"([^>]*?)href="(/[^"]+)"([^>]*?)>
    }x

    module_function

    def process(doc)
      return unless doc.output_ext == '.html'
      return unless doc.output

      site_url = doc.site.config['url'].to_s.chomp('/')
      return if site_url.empty?

      doc.output = doc.output.gsub(RELATIVE_LINK_PATTERN) do
        rel = Regexp.last_match(1)
        before = Regexp.last_match(2)
        path = Regexp.last_match(3)
        after = Regexp.last_match(4)
        %(<link rel="#{rel}"#{before}href="#{site_url}#{path}"#{after}>)
      end
    end
  end
end

Jekyll::Hooks.register(:pages, :post_render, priority: :low) { |page| Jekyll::AbsoluteAlternateLinks.process(page) }
Jekyll::Hooks.register(:documents, :post_render, priority: :low) { |doc| Jekyll::AbsoluteAlternateLinks.process(doc) }
