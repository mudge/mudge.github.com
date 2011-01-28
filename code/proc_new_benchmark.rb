require "benchmark"

def sometimes_block(flag, &block)
  if flag && block
    block.call
  end
end

def sometimes_proc_new(flag)
  if flag && block_given?
    Proc.new.call
  end
end

n = 1_000_000
Benchmark.bmbm do |x|
  x.report("&block") do
    n.times do
      sometimes_block(false) { "won't get used" }
    end
  end
  x.report("Proc.new") do
    n.times do
      sometimes_proc_new(false) { "won't get used" }
    end
  end
end
