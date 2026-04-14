import re
import hashlib
from pathlib import Path
from collections import defaultdict
import os

def load_docs_dir(recycle_env='local'):
    '''Load DOCS_DIR from env.common + env.{local/prod}.'''
    script_root = Path(__file__).parent.parent
    import dotenv
    dotenv.load_dotenv(script_root / 'env.common')
    dotenv.load_dotenv(script_root / f'env.{recycle_env}')
    docs_dir = os.getenv('DOCS_DIR')
    if not docs_dir:
        print('Warning: DOCS_DIR not in env files, fallback to "docs"')
        return 'docs'
    return docs_dir

class DocAggregator:
    def __init__(self, docs_dir):
        self.docs_dir = Path(docs_dir)
        self.graph = defaultdict(list)

    def build_graph(self):
        '''Build graph from all *.md files by parsing [[links]].'''
        for md_file in self.docs_dir.glob('**/*.md'):
            rel_path = md_file.relative_to(self.docs_dir)
            content = md_file.read_text()
            links = re.findall(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', content)
            for link in links:
                note = link[0].strip()
                note_stem = note.replace(' ', '-')
                linked_path = self.docs_dir / f'{note_stem}.md'
                if linked_path.exists():
                    self.graph[str(rel_path)].append(str(linked_path.relative_to(self.docs_dir)))

    def get_visited_order(self, start):
        '''Get sorted list of all reachable docs from start (DFS, no cycles).'''
        visited = set()
        stack = [start]
        order = []
        while stack:
            current = stack.pop()
            if current in visited:
                continue
            visited.add(current)
            order.append(current)
            for link in self.graph.get(current, []):
                stack.append(link)
        order.sort()
        return order

    def get_docs_cache_string(self, recycle_env=None):
        '''Return docs cache XML string (no file write).'''
        self.build_graph()
        start = 'Home.md'
        if not (self.docs_dir / start).exists():
            raise ValueError(f'Single entry {start} not found in {self.docs_dir}')
        order = self.get_visited_order(start)
        docs_content = {}
        for node in order:
            node_path = self.docs_dir / node
            if node_path.exists():
                docs_content[node] = node_path.read_text()
            else:
                docs_content[node] = f'<!-- Missing: {node} -->'
        output = '''<docs_cache>
<instruction>
Cached Recycler AI docs for Grok 4.20 planning. Single entry: Home.md. Use template, [[wikilinks]], Implementation Details. Stable - do not modify. Saves tokens.
</instruction>

''' + ''.join([f'<doc name="{node}">{docs_content[node]}</doc>\n' for node in order]) + '''

<guidance>
For planning: Reference exact sections. Output numbered plan with files, mermaid, edge cases. Use this cache for all future plans.
</guidance>
</docs_cache>'''
        return output

if __name__ == '__main__':
    docs_dir = load_docs_dir()
    print(f"Using DOCS_DIR: {docs_dir}")
    env = os.getenv('RECYCLE_AI_ENV', 'local')
    cache = DocAggregator(docs_dir).get_docs_cache_string(env)
    print("Docs cache string ready (first 500 chars):")
    print(cache[:500])