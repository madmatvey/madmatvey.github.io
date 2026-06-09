# frozen_string_literal: true

# GitHub Pages serves paginated URLs with a trailing slash (/page2/), but
# jekyll-paginate and jekyll-seo-tag emit /page2, which 301-redirects.
module FixPaginationTrailingSlash
  module_function

  PAGINATION_LINK_RE = %r{(<link rel="(?:next|prev)" href="[^"]*/page\d+)(?=")}i

  def fix!(doc)
    return unless doc.output_ext == '.html'

    output = doc.output
    return unless output&.match?(PAGINATION_LINK_RE)

    doc.output = output.gsub(PAGINATION_LINK_RE, '\1/')
  end
end

Jekyll::Hooks.register :pages, :post_render, priority: :lowest do |doc|
  FixPaginationTrailingSlash.fix!(doc)
end

Jekyll::Hooks.register :documents, :post_render, priority: :lowest do |doc|
  FixPaginationTrailingSlash.fix!(doc)
end
