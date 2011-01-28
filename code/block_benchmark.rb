require "benchmark"

class ProcMonkey
  def self.speak(&block)
    block.call
  end
end

class BlockMonkey
  def self.speak
    yield
  end
end

n = 1_000_000
Benchmark.bmbm do |x|
  x.report("&block") { n.times { ProcMonkey.speak { "ook" } } }
  x.report("yield")  { n.times { BlockMonkey.speak { "ook" } } }
end
