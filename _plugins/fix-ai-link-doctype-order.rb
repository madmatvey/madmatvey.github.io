# frozen_string_literal: true

# jekyll-ai-visible-content prepends ai:* link tags when a page has no </head>
# (e.g. jekyll-redirect-from stubs), which pushes DOCTYPE off the first line.
module FixAiLinkDoctypeOrder
  module_function

  def fix!(doc)
    return unless doc.output_ext == '.html'

    output = doc.output
    return unless output&.match?(%r{\A<link rel="ai:})

    links = output.scan(%r{<link rel="ai:[^"]*"[^>]*>}).join("\n")
    body = output.sub(%r{\A(?:<link rel="ai:[^"]*"[^>]*>\s*)+}, '')

    doc.output =
      if body.include?('</head>')
        body.sub('</head>', "#{links}\n</head>")
      elsif (html_open = body.match(%r{<!DOCTYPE html>\s*<html([^>]*)>}i))
        attrs = html_open[1].to_s
        lang = attrs[/lang="([^"]*)"/i, 1]
        lang = 'en' if lang.nil? || lang.start_with?('en')
        body.sub(
          %r{<!DOCTYPE html>\s*<html[^>]*>}i,
          "<!DOCTYPE html>\n<html lang=\"#{lang}\">\n<head>\n#{links}\n<meta charset=\"utf-8\">\n</head>"
        )
      else
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n#{links}\n</head>\n#{body}"
      end
  end
end

Jekyll::Hooks.register :pages, :post_render, priority: :low do |doc|
  FixAiLinkDoctypeOrder.fix!(doc)
end

Jekyll::Hooks.register :documents, :post_render, priority: :low do |doc|
  FixAiLinkDoctypeOrder.fix!(doc)
end
