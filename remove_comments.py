import os
import re
import ast
from pathlib import Path
from typing import List, Tuple

def remove_python_comments(file_path: Path) -> bool:
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content

        lines = content.split('\n')
        cleaned_lines = []
        
        for line in lines:

            in_string = False
            quote_char = None
            comment_pos = -1
            
            for i, char in enumerate(line):
                if char in ('"', "'") and (i == 0 or line[i-1] != '\\'):
                    if not in_string:
                        in_string = True
                        quote_char = char
                    elif char == quote_char:
                        in_string = False
                        quote_char = None
                elif char == '#' and not in_string:
                    comment_pos = i
                    break
            
            if comment_pos >= 0:
                line = line[:comment_pos].rstrip()
            
            cleaned_lines.append(line)
        
        content = '\n'.join(cleaned_lines)

        try:
            tree = ast.parse(content)

            class DocstringRemover(ast.NodeTransformer):
                def visit_FunctionDef(self, node):
                    if (node.body and 
                        isinstance(node.body[0], ast.Expr) and 
                        isinstance(node.body[0].value, ast.Constant) and 
                        isinstance(node.body[0].value.value, str)):
                        node.body = node.body[1:]
                    return self.generic_visit(node)
                
                def visit_ClassDef(self, node):
                    if (node.body and 
                        isinstance(node.body[0], ast.Expr) and 
                        isinstance(node.body[0].value, ast.Constant) and 
                        isinstance(node.body[0].value.value, str)):
                        node.body = node.body[1:]
                    return self.generic_visit(node)
                
                def visit_Module(self, node):
                    if (node.body and 
                        isinstance(node.body[0], ast.Expr) and 
                        isinstance(node.body[0].value, ast.Constant) and 
                        isinstance(node.body[0].value.value, str)):
                        node.body = node.body[1:]
                    return self.generic_visit(node)

            remover = DocstringRemover()
            new_tree = remover.visit(tree)

            import astor
            content = astor.to_source(new_tree)
            
        except Exception:

            content = re.sub(r'', '', content)
            content = re.sub(r"", '', content)

        content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
        content = content.strip() + '\n' if content.strip() else content

        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def remove_typescript_comments(file_path: Path) -> bool:
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content

        content = re.sub(r'/\*\*[\s\S]*?\*/', '', content)
        content = re.sub(r'/\*[\s\S]*?\*/', '', content)

        lines = content.split('\n')
        cleaned_lines = []
        
        for line in lines:

            in_string = False
            quote_char = None
            comment_pos = -1
            
            for i, char in enumerate(line):
                if char in ('"', "'", '`') and (i == 0 or line[i-1] != '\\'):
                    if not in_string:
                        in_string = True
                        quote_char = char
                    elif char == quote_char:
                        in_string = False
                        quote_char = None
                elif (char == '/' and i + 1 < len(line) and 
                      line[i+1] == '/' and not in_string):
                    comment_pos = i
                    break
            
            if comment_pos >= 0:
                line = line[:comment_pos].rstrip()
            
            cleaned_lines.append(line)
        
        content = '\n'.join(cleaned_lines)

        content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
        content = content.strip() + '\n' if content.strip() else content

        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def find_code_files(root_dir: Path) -> Tuple[List[Path], List[Path]]:
    
    python_files = []
    js_files = []

    python_extensions = {'.py'}
    js_extensions = {'.ts', '.tsx', '.js', '.jsx'}

    skip_dirs = {
        '.git', '.venv', '__pycache__', 'node_modules', 
        '.pytest_cache', 'migrations', '.vscode', '.idea'
    }
    
    for file_path in root_dir.rglob('*'):
        if file_path.is_file():

            if any(skip_dir in file_path.parts for skip_dir in skip_dirs):
                continue
            
            suffix = file_path.suffix.lower()
            if suffix in python_extensions:
                python_files.append(file_path)
            elif suffix in js_extensions:
                js_files.append(file_path)
    
    return python_files, js_files

def main():
    
    import sys

    if sys.platform == 'win32':
        import locale
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer)
    
    root_dir = Path(__file__).parent
    
    print("Searching for code files...")
    python_files, js_files = find_code_files(root_dir)
    
    print(f"Found {len(python_files)} Python files and {len(js_files)} TypeScript/JavaScript files")
    
    modified_count = 0
    error_count = 0
    
    print("\nProcessing Python files...")
    for file_path in python_files:
        if remove_python_comments(file_path):
            print(f"  Modified: {file_path.relative_to(root_dir)}")
            modified_count += 1
        else:
            print(f"  No changes: {file_path.relative_to(root_dir)}")
    
    print("\nProcessing TypeScript/JavaScript files...")
    for file_path in js_files:
        if remove_typescript_comments(file_path):
            print(f"  Modified: {file_path.relative_to(root_dir)}")
            modified_count += 1
        else:
            print(f"  No changes: {file_path.relative_to(root_dir)}")
    
    print(f"\nComplete! Modified {modified_count} files.")
    
    if error_count > 0:
        print(f"Encountered {error_count} errors during processing.")

if __name__ == "__main__":
    main()
