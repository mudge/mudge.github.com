require "benchmark"

def speak_with_block(&block)
  block.call
end

def speak_with_yield
  yield
end

n = 1_000_000
Benchmark.bmbm do |x|
  x.report("&block") { n.times { speak_with_block { "ook" } } }
  x.report("yield")  { n.times { speak_with_yield { "ook" } } }
end
