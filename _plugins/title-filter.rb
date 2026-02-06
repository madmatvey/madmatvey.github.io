module Jekyll
  module TitleFilter
    def smart_title(page_title)
      return "Eugene The Engineer" if page_title.nil? || page_title.empty?
      
      site_title = "Eugene The Engineer"
      suffix = " | #{site_title}"
      
      # Calculate total length
      total_length = page_title.length + suffix.length
      
      # If total length <= 65, use suffix, otherwise use only page title
      if total_length <= 65
        "#{page_title}#{suffix}"
      else
        page_title
      end
    end
  end
end

Liquid::Template.register_filter(Jekyll::TitleFilter)
