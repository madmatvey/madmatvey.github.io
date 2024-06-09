# frozen_string_literal: true

source "https://rubygems.org"

group :test do
  gem "html-proofer", "~> 4.4"
end

# Windows and JRuby does not include zoneinfo files, so bundle the tzinfo-data gem
# and associated library.
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]

# Lock `http_parser.rb` gem to `v0.6.x` on JRuby builds since newer versions of the gem
# do not have a Java counterpart.
gem "jekyll", "~> 4.3"

group :jekyll_plugins do
  gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]
  gem "jekyll-paginate", "~> 1.1"
  gem "jekyll-redirect-from", "~> 0.16"
  gem "jekyll-seo-tag", "~> 2.8"
  gem "jekyll-archives", "~> 2.2"
  gem "jekyll-sitemap", "~> 1.4"
  gem "jekyll-include-cache", "~> 0.2"
  gem "jekyll-theme-chirpy", "~> 6.5.5"
  gem "jekyll-google-tag-manager", "~> 1.0"
  gem "jekyll-crypto-donations", "~> 0.1.3" #, path: "../jekyll-crypto-donations"
end