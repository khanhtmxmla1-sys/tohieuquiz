import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type ImportGraph = Map<string, Set<string>>;

const normalize = (
  filePath: string,
  caseSensitive = ts.sys.useCaseSensitiveFileNames,
): string => {
  const normalized = path.normalize(path.resolve(filePath));
  return caseSensitive ? normalized : normalized.toLowerCase();
};

const isSourceFile = (filePath: string): boolean => {
  const relative = path.relative(process.cwd(), filePath);
  const basename = path.basename(filePath);
  return relative.startsWith(`src${path.sep}`)
    && !relative.split(path.sep).includes('__tests__')
    && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(basename)
    && (filePath.endsWith('.ts') || filePath.endsWith('.tsx'));
};

const resolveImport = (
  specifier: string,
  containingFile: string,
  compilerOptions: ts.CompilerOptions,
): string | null => {
  const resolved = ts.resolveModuleName(
    specifier,
    containingFile,
    compilerOptions,
    ts.sys,
  ).resolvedModule?.resolvedFileName;
  if (!resolved) return null;
  const normalized = normalize(resolved);
  return isSourceFile(normalized) ? normalized : null;
};

const collectImportSpecifiers = (sourceFile: ts.SourceFile): string[] => {
  const specifiers: string[] = [];
  const literalModuleSpecifier = (node: ts.Node | undefined): string | null => {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) return node.literal.text;
    return null;
  };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const specifier = literalModuleSpecifier(node.arguments[0]);
      if (specifier) specifiers.push(specifier);
    }
    if (ts.isImportTypeNode(node)) {
      const specifier = literalModuleSpecifier(node.argument);
      if (specifier) specifiers.push(specifier);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
};

const buildImportGraph = (): ImportGraph => {
  const config = ts.readConfigFile(path.resolve('tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  if (parsed.errors.length > 0) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    }));
  }
  const files = parsed.fileNames
    .map((file) => normalize(file))
    .filter(isSourceFile);
  const fileSet = new Set(files);
  const graph: ImportGraph = new Map(files.map((file) => [file, new Set()]));

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const specifier of collectImportSpecifiers(source)) {
      const imported = resolveImport(specifier, file, parsed.options);
      if (imported && fileSet.has(imported)) graph.get(file)?.add(imported);
    }
  }
  return graph;
};

const findCircularComponents = (graph: ImportGraph): string[][] => {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const components: string[][] = [];

  const visit = (file: string): void => {
    indexes.set(file, index);
    lowLinks.set(file, index);
    index += 1;
    stack.push(file);
    onStack.add(file);

    for (const imported of graph.get(file) ?? []) {
      if (!indexes.has(imported)) {
        visit(imported);
        lowLinks.set(file, Math.min(lowLinks.get(file)!, lowLinks.get(imported)!));
      } else if (onStack.has(imported)) {
        lowLinks.set(file, Math.min(lowLinks.get(file)!, indexes.get(imported)!));
      }
    }

    if (lowLinks.get(file) !== indexes.get(file)) return;
    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== file);
    if (component.length > 1 || graph.get(component[0])?.has(component[0])) {
      components.push(component.sort());
    }
  };

  for (const file of graph.keys()) if (!indexes.has(file)) visit(file);
  return components.sort((left, right) => left.join('\n').localeCompare(right.join('\n')));
};

const relativeComponents = (components: string[][]): string[][] => components.map(
  (component) => component.map((file) => path.relative(process.cwd(), file).split(path.sep).join('/')),
);

describe('frontend import graph', () => {
  it('canonicalizes Windows paths without changing case-sensitive paths', () => {
    const sample = path.join(process.cwd(), 'src', 'App.tsx');
    expect(normalize(sample, false)).toBe(normalize(sample.toUpperCase(), false));
    expect(normalize(sample, true)).not.toBe(normalize(sample.toUpperCase(), true));
  });

  it('has no circular production src imports', () => {
    const graph = buildImportGraph();
    expect(graph.size).toBeGreaterThan(0);
    const studentQuizView = normalize(path.resolve('src/app/StudentQuizView.tsx'));
    const studentViewLazy = normalize(path.resolve('src/app/studentViewLazy.ts'));
    expect(graph.get(studentQuizView)?.has(studentViewLazy)).toBe(true);
    const cycles = relativeComponents(findCircularComponents(graph));
    expect(cycles, `Circular import components:\n${JSON.stringify(cycles, null, 2)}`).toEqual([]);
  }, 30_000);

  it('detects cyclic graph fixtures instead of treating a graph as empty', () => {
    const graph: ImportGraph = new Map([
      ['a.ts', new Set(['b.ts'])],
      ['b.ts', new Set(['a.ts'])],
      ['self.ts', new Set(['self.ts'])],
      ['leaf.ts', new Set()],
    ]);
    expect(findCircularComponents(graph)).toEqual([
      ['a.ts', 'b.ts'],
      ['self.ts'],
    ]);
  });
});
