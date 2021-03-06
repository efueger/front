#!/usr/bin/env ruby

require 'digest'

class Builder
  SOURCE_DIR = 'src'
  OUTPUT_DIR = 'build'
  CACHE_FILE = 'build/.cache'

  @can_build = false

  def initialize
    case missing_requirements
    when :scss
      puts 'Missing SCSS compiler!'
      return
    when :js
      puts 'Missing Clojure JS compiler!'
      return
    end

    @can_build = true
    @signature_cache = load_signatures
    @signatures = {}
  end

  def save_signatures
    File.write(CACHE_FILE, Marshal.dump(@signatures))
  end

  def build
    return unless @can_build

    source_files = files_in_path(SOURCE_DIR + '/**')
    hash_files(source_files)
    changed_count = changed_files.count

    if changed_count == 0
      puts "No files changed!" and return
    end

    build_start_time = Time.now

    changed_files.each_with_index do |file, index|
      print "Building #{index + 1}/#{changed_count} #{file} "
      start_time = Time.now
      build_file(file)
      finish_time = Time.now
      puts "#{finish_time - start_time} seconds"
    end

    build_finish_time = Time.now

    puts "Finished! #{build_finish_time - build_start_time} seconds"

    compress_build if should_bundle?
  end

  def compress_build
    compressed_file = 'build.tar.bz2'
    script = "tar cjf #{compressed_file} -C #{OUTPUT_DIR} ."

    puts "Compressing build (#{compressed_file})"
    %x[ #{script} ]
  end

  private

  # "Compiles" a JS file.
  def js(input)
    # Location of compiled file.
    output_file       = output_file_path(input)
    # Format of source map to generate
    source_map_format = 'V3'
    # Location of generated source map.
    source_map_file   = output_file + '.map'
    # Input language used.
    language_input    = 'ECMASCRIPT5'

    script = "java -jar #{js_compiler_path} " \
      "--create_source_map #{source_map_file} "\
      "--source_map_format=#{source_map_format} "\
      '--language_in=ECMASCRIPT5 ' \
      "--js #{input} " \
      "--js_output_file=#{output_file} "

    %x[ #{script} ]
  end

  # "Compiles" as SCSS file.
  def scss(input)
    output_file = output_file_path(input) + '.css'

    # -m emits sourcemap.
    script = "#{scss_compiler_path} -m #{input} #{output_file}"

    %x[ #{script} ]
  end

  def copy(input)
    output_file = output_file_path(input)

    script = "cp #{input} #{output_file}"

    %x[ #{script} ]
  end

  def build_file(file_path)
    case file_type(file_path)
    when :scss
      scss(file_path)
    when :js
      js(file_path)
    else
      copy(file_path)
    end
  end

  def hash_files(files)
    hash_start_time = Time.now
    files.each do |file|
      @signatures[file] = Digest::SHA1.file(file).digest
    end
    hash_finish_time = Time.now

    puts "Finished hashing at #{hash_finish_time - hash_start_time} seconds"
  end

  def changed_files
    @signatures.each_key.map do |f|
      @signature_cache[f] != @signatures[f] ? f : nil
    end.compact
  end

  def output_file_path(input)
    file_base = File.basename(input, '.scss')

    if input.include?("lib/#{file_base}")
      file_base = "lib/#{file_base}"
    end

    "#{OUTPUT_DIR}/#{file_base}"
  end

  def missing_requirements
    return :js unless js_compiler_exists?
    return :scss unless scss_compiler_exists?
    return nil
  end

  def scss_compiler_path
    `which sassc`.strip
  end

  def scss_compiler_exists?
    File.exist?(scss_compiler_path)
  end

  def js_compiler_path
    @_js ||= "#{npm}/lib/node_modules/google-closure-compiler/compiler.jar"
  end

  def js_compiler_exists?
    File.exist?(js_compiler_path)
  end

  def npm
    ENV['NPM_PACKAGES']
  end

  def files_in_path(path)
    Dir.glob("#{path}/*").reject{ |f| File.directory?(f) }.sort
  end

  def file_type(path)
    File.extname(path).tr('.','').to_sym
  end

  def load_signatures
    if File.exist?(CACHE_FILE)
      Marshal.load(File.read(CACHE_FILE)) rescue {}
    else
      {}
    end
  end

  def should_bundle?
    ARGV[0] == 'bundle'
  end
end

b = Builder.new
b.build
b.save_signatures
