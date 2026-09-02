// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ts from 'typescript';
import type { ConfigEnv, UserConfig } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import viteConfig from '../vite.config';
import {
  REQUIRED_RELEASE_CHECKS,
  validateCompetitionReleaseArtifacts,
  validateReleaseFlags,
} from '../scripts/release-readiness.mjs';
import {
  createCompetitionEventLogger,
  sanitizeCompetitionLogMetadata,
} from '../workers/src/competition/observability';

const greenCapacityReport = {
  benchmarkRunId: 'competition-release-100',
  build: { sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  config: { runtimeConfigVersion: 'cfg-1' },
  polling: { profileVersion: 'poll-1', statusRounds: 3 },
  passed: true,
  summary: {
    concurrency: 100,
    statusP95Ms: 499,
    submitP95Ms: 1_999,
    lostAnswers: 0,
    duplicateFailures: 0,
    d1OverloadErrors: 0,
    app5xx: 0,
    networkErrors: 0,
  },
};

const getModuleBasename = (moduleSpecifier: string) => {
  const normalized = moduleSpecifier.replace(/\\/g, '/');
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1);
  return fileName.replace(/\.(?:[cm]?[jt]sx?)$/, '');
};

const collectDynamicImportSpecifiers = (node: ts.Node) => {
  const specifiers: string[] = [];
  const visit = (current: ts.Node): void => {
    if (ts.isCallExpression(current)
      && current.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [specifier] = current.arguments;
      if (specifier && ts.isStringLiteralLike(specifier)) {
        specifiers.push(specifier.text);
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return specifiers;
};

const findLazyBoundaryDeclarations = (sourceFile: ts.SourceFile) => {
  let declarationCount = 0;
  const visit = (current: ts.Node): void => {
    if (ts.isVariableDeclaration(current)
      && ts.isIdentifier(current.name)
      && current.name.text === 'CompetitionPortalSeoBoundary'
      && current.initializer
      && ts.isCallExpression(current.initializer)
      && ts.isPropertyAccessExpression(current.initializer.expression)
      && ts.isIdentifier(current.initializer.expression.expression)
      && current.initializer.expression.expression.text === 'React'
      && current.initializer.expression.name.text === 'lazy') {
      const [lazyLoader] = current.initializer.arguments;
      if (lazyLoader
        && collectDynamicImportSpecifiers(lazyLoader)
          .map(getModuleBasename)
          .includes('CompetitionPortalSeoBoundary')) {
        declarationCount += 1;
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(sourceFile);
  return declarationCount;
};

const getLoaderReturnExpression = (loader: ts.Node): ts.Expression | undefined => {
  if (!ts.isArrowFunction(loader) && !ts.isFunctionExpression(loader)) {
    return undefined;
  }
  if (!ts.isBlock(loader.body)) {
    return loader.body;
  }
  const returnStatements = loader.body.statements.filter(ts.isReturnStatement);
  return returnStatements.length === 1 ? returnStatements[0].expression : undefined;
};

const isDirectLegacyCompetitionRedirectImport = (expression: ts.Expression | undefined) => (
  Boolean(expression
    && ts.isCallExpression(expression)
    && expression.expression.kind === ts.SyntaxKind.ImportKeyword
    && expression.arguments.length === 1
    && ts.isStringLiteralLike(expression.arguments[0])
    && getModuleBasename(expression.arguments[0].text) === 'LegacyCompetitionRedirect')
);

const findLegacyCompetitionRedirectLazyDeclarations = (sourceFile: ts.SourceFile) => {
  let totalDeclarationCount = 0;
  let validLazyDeclarationCount = 0;
  const visit = (current: ts.Node): void => {
    if (ts.isVariableDeclaration(current)
      && ts.isIdentifier(current.name)
      && current.name.text === 'LegacyCompetitionRedirect') {
      totalDeclarationCount += 1;
      if (current.initializer
        && ts.isCallExpression(current.initializer)
        && current.initializer.arguments.length === 1
        && !current.initializer.typeArguments?.length
        && ts.isPropertyAccessExpression(current.initializer.expression)
        && ts.isIdentifier(current.initializer.expression.expression)
        && current.initializer.expression.expression.text === 'React'
        && current.initializer.expression.name.text === 'lazy') {
        const [lazyLoader] = current.initializer.arguments;
        if (isDirectLegacyCompetitionRedirectImport(getLoaderReturnExpression(lazyLoader))) {
          validLazyDeclarationCount += 1;
        }
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(sourceFile);
  return { totalDeclarationCount, validLazyDeclarationCount };
};

const isDirectChatBotImport = (expression: ts.Expression | undefined) => (
  Boolean(expression
    && ts.isCallExpression(expression)
    && expression.expression.kind === ts.SyntaxKind.ImportKeyword
    && expression.arguments.length === 1
    && ts.isStringLiteralLike(expression.arguments[0])
    && expression.arguments[0].text.replace(/\\/g, '/').endsWith('/components/ChatBot/ChatBot'))
);

const findChatBotLazyDeclarations = (sourceFile: ts.SourceFile) => {
  let totalDeclarationCount = 0;
  let validLazyDeclarationCount = 0;
  const visit = (current: ts.Node): void => {
    if (ts.isVariableDeclaration(current)
      && ts.isIdentifier(current.name)
      && current.name.text === 'ChatBot') {
      totalDeclarationCount += 1;
      if (current.initializer
        && ts.isCallExpression(current.initializer)
        && current.initializer.arguments.length === 1
        && !current.initializer.typeArguments?.length
        && ts.isPropertyAccessExpression(current.initializer.expression)
        && ts.isIdentifier(current.initializer.expression.expression)
        && current.initializer.expression.expression.text === 'React'
        && current.initializer.expression.name.text === 'lazy') {
        const [lazyLoader] = current.initializer.arguments;
        if (isDirectChatBotImport(getLoaderReturnExpression(lazyLoader))) {
          validLazyDeclarationCount += 1;
        }
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(sourceFile);
  return { totalDeclarationCount, validLazyDeclarationCount };
};

const isCompetitionRouteGateName = (name: string) => {
  const lowerName = name.toLowerCase();
  return /^is[A-Z]/.test(name)
    && lowerName.includes('competition')
    && (lowerName.includes('route') || lowerName.includes('path'));
};

const hasExactRouteComparison = (node: ts.Node, route: string): boolean => {
  if (ts.isBinaryExpression(node)
    && (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken
      || node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken)
    && ((ts.isStringLiteralLike(node.left) && node.left.text === route)
      || (ts.isStringLiteralLike(node.right) && node.right.text === route))) {
    return true;
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && hasExactRouteComparison(child, route)) {
      found = true;
    }
  });
  return found;
};

const hasDescendantRouteCheck = (node: ts.Node, route: string): boolean => {
  if (ts.isCallExpression(node)
    && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === 'startsWith') {
    const [prefix] = node.arguments;
    if (prefix && ts.isStringLiteralLike(prefix) && prefix.text === `${route}/`) {
      return true;
    }
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && hasDescendantRouteCheck(child, route)) {
      found = true;
    }
  });
  return found;
};

const findCompetitionRouteGates = (sourceFile: ts.SourceFile) => {
  const gates: Array<{ name: string }> = [];
  const visit = (current: ts.Node): void => {
    if (ts.isVariableDeclaration(current)
      && ts.isIdentifier(current.name)
      && current.initializer
      && isCompetitionRouteGateName(current.name.text)) {
      if (hasExactRouteComparison(current.initializer, '/cuoc-thi')
        && hasDescendantRouteCheck(current.initializer, '/cuoc-thi')
        && hasExactRouteComparison(current.initializer, '/thi')
        && hasDescendantRouteCheck(current.initializer, '/thi')) {
        gates.push({ name: current.name.text });
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(sourceFile);
  return gates;
};

const getJsxTagName = (tagName: ts.JsxTagNameExpression) => (
  ts.isIdentifier(tagName) ? tagName.text : ''
);

const hasNullSuspenseFallback = (element: ts.JsxElement) => {
  const fallback = element.openingElement.attributes.properties.find(
    (property) => ts.isJsxAttribute(property)
      && ts.isIdentifier(property.name)
      && property.name.text === 'fallback',
  );
  return Boolean(fallback
    && ts.isJsxAttribute(fallback)
    && fallback.initializer
    && ts.isJsxExpression(fallback.initializer)
    && fallback.initializer.expression?.kind === ts.SyntaxKind.NullKeyword);
};

const containsCompetitionSeoBoundary = (node: ts.Node): boolean => {
  if (ts.isJsxSelfClosingElement(node)) {
    return getJsxTagName(node.tagName) === 'CompetitionPortalSeoBoundary';
  }
  if (ts.isJsxElement(node)
    && getJsxTagName(node.openingElement.tagName) === 'CompetitionPortalSeoBoundary') {
    return true;
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && containsCompetitionSeoBoundary(child)) {
      found = true;
    }
  });
  return found;
};

const containsChatBot = (node: ts.Node): boolean => {
  if (ts.isJsxSelfClosingElement(node)) {
    return getJsxTagName(node.tagName) === 'ChatBot';
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && containsChatBot(child)) {
      found = true;
    }
  });
  return found;
};

const isDirectPositiveShowChatbotGate = (node: ts.Expression) => {
  const condition = ts.skipParentheses(node);
  return ts.isIdentifier(condition) && condition.text === 'showChatbot';
};

const containsGatedChatBotSuspense = (node: ts.Node): boolean => {
  const chatBotRenders: Array<ts.JsxSelfClosingElement | ts.JsxElement> = [];
  const collectChatBotRenders = (current: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(current)
      && getJsxTagName(current.tagName) === 'ChatBot') {
      chatBotRenders.push(current);
    }
    if (ts.isJsxElement(current)
      && getJsxTagName(current.openingElement.tagName) === 'ChatBot') {
      chatBotRenders.push(current);
    }
    ts.forEachChild(current, collectChatBotRenders);
  };
  collectChatBotRenders(node);

  const isRenderGated = (chatBotRender: ts.JsxSelfClosingElement | ts.JsxElement) => {
    let current: ts.Node | undefined = chatBotRender.parent;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isJsxElement(current)
        && getJsxTagName(current.openingElement.tagName) === 'Suspense'
        && hasNullSuspenseFallback(current)) {
        let boundaryParent: ts.Node | undefined = current.parent;
        while (boundaryParent && ts.isParenthesizedExpression(boundaryParent)) {
          boundaryParent = boundaryParent.parent;
        }
        if (boundaryParent
          && ts.isBinaryExpression(boundaryParent)
          && boundaryParent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
          && isDirectPositiveShowChatbotGate(boundaryParent.left)
          && ts.skipParentheses(boundaryParent.right) === current) {
          return true;
        }
      }
      current = current.parent;
    }
    return false;
  };

  return chatBotRenders.length > 0 && chatBotRenders.every(isRenderGated);
};

const containsSeoSuspenseBoundary = (node: ts.Node): boolean => {
  if (ts.isJsxElement(node)
    && getJsxTagName(node.openingElement.tagName) === 'Suspense'
    && hasNullSuspenseFallback(node)
    && containsCompetitionSeoBoundary(node)) {
    return true;
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && containsSeoSuspenseBoundary(child)) {
      found = true;
    }
  });
  return found;
};

const containsIdentifier = (node: ts.Node, name: string): boolean => {
  if (ts.isIdentifier(node)) {
    return node.text === name;
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && containsIdentifier(child, name)) {
      found = true;
    }
  });
  return found;
};

const getFunctionReturnExpression = (node: ts.Node): ts.Expression | undefined => {
  let body: ts.Block | ts.Expression | undefined;
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    body = node.body;
  } else if (ts.isFunctionDeclaration(node)) {
    body = node.body;
  }
  if (!body || !ts.isBlock(body)) {
    return undefined;
  }

  let returnExpression: ts.Expression | undefined;
  const visit = (current: ts.Node): void => {
    if (returnExpression
      || ts.isFunctionDeclaration(current)
      || ts.isFunctionExpression(current)
      || ts.isArrowFunction(current)) {
      return;
    }
    if (ts.isReturnStatement(current)) {
      returnExpression = current.expression;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(body);
  return returnExpression;
};

const findMainAppReturnExpression = (sourceFile: ts.SourceFile) => {
  let returnExpression: ts.Expression | undefined;
  const visit = (current: ts.Node): void => {
    if (returnExpression) {
      return;
    }
    if (ts.isVariableDeclaration(current)
      && ts.isIdentifier(current.name)
      && current.name.text === 'MainApp'
      && current.initializer) {
      returnExpression = getFunctionReturnExpression(current.initializer);
      return;
    }
    if (ts.isFunctionDeclaration(current)
      && ts.isIdentifier(current.name)
      && current.name.text === 'MainApp') {
      returnExpression = getFunctionReturnExpression(current);
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(sourceFile);
  return returnExpression;
};

const findCoupledRouteGates = (returnExpression: ts.Expression, gateNames: Set<string>) => {
  const coupledNames = new Set<string>();
  const addReferencedGates = (condition: ts.Node) => {
    gateNames.forEach((name) => {
      if (containsIdentifier(condition, name)) {
        coupledNames.add(name);
      }
    });
  };
  const visit = (current: ts.Node): void => {
    if (ts.isBinaryExpression(current)
      && current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && containsSeoSuspenseBoundary(current.right)) {
      addReferencedGates(current.left);
    }
    if (ts.isConditionalExpression(current)
      && containsSeoSuspenseBoundary(current.whenTrue)) {
      addReferencedGates(current.condition);
    }
    ts.forEachChild(current, visit);
  };
  visit(returnExpression);
  return coupledNames;
};

describe('Competition V1 release hardening', () => {
  it('assigns deterministic vendor ownership with function-form manualChunks', async () => {
    const configEnv: ConfigEnv = {
      command: 'build',
      mode: 'production',
      isSsrBuild: false,
      isPreview: false,
    };
    const resolvedConfig = typeof viteConfig === 'function'
      ? await viteConfig(configEnv)
      : await Promise.resolve(viteConfig) as UserConfig;
    const output = resolvedConfig.build?.rollupOptions?.output;

    expect(output).toBeDefined();
    expect(Array.isArray(output)).toBe(false);
    if (!output || Array.isArray(output)) {
      return;
    }

    expect(typeof output.manualChunks).toBe('function');
    if (typeof output.manualChunks !== 'function') {
      return;
    }

    const assignChunk = (moduleId: string) => output.manualChunks?.(moduleId, {} as never);

    expect(assignChunk('C:/repo/node_modules/react/jsx-runtime.js')).toBe('vendor-react');
    expect(assignChunk('C:/repo/node_modules/react/cjs/react-jsx-runtime.production.js')).toBe('vendor-react');
    expect(assignChunk('C:/repo/node_modules/react-dom/client.js')).toBe('vendor-react');
    expect(assignChunk('C:\\repo\\node_modules\\react\\jsx-runtime.js')).toBe('vendor-react');
    expect(assignChunk('C:/repo/node_modules/lucide-react/dist/cjs/lucide-react.js')).toBe('vendor-icons');
    expect(assignChunk('C:/repo/node_modules/zustand/esm/index.mjs')).toBe('vendor-state');
    expect(assignChunk('C:/repo/node_modules/framer-motion/dist/es/index.mjs')).toBe('vendor-motion');
    expect(assignChunk('C:/repo/node_modules/motion-dom/dist/es/index.mjs')).toBe('vendor-motion');
    expect(assignChunk('C:/repo/node_modules/motion-utils/dist/es/index.mjs')).toBe('vendor-motion');
    expect(assignChunk('C:/repo/node_modules/jszip/lib/index.js')).toBe('vendor-jszip');
    expect(assignChunk('C:/repo/src/app/App.tsx')).toBeUndefined();
  });

  it('keeps ChatBot and its motion dependency out of the eager app shell', () => {
    const appGlobalsSource = readFileSync(new URL('../src/app/AppGlobals.tsx', import.meta.url), 'utf8');
    const sourceFile = ts.createSourceFile(
      'AppGlobals.tsx',
      appGlobalsSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const staticChatBotImports = sourceFile.statements.filter(
      (statement) => ts.isImportDeclaration(statement)
        && ts.isStringLiteral(statement.moduleSpecifier)
        && getModuleBasename(statement.moduleSpecifier.text) === 'ChatBot',
    );
    expect(staticChatBotImports).toHaveLength(0);
    expect(findChatBotLazyDeclarations(sourceFile)).toEqual({
      totalDeclarationCount: 1,
      validLazyDeclarationCount: 1,
    });
    expect(containsGatedChatBotSuspense(sourceFile)).toBe(true);

    const invertedGateSource = ts.createSourceFile(
      'inverted-chatbot-gate.tsx',
      `const AppGlobals = ({ showChatbot }) => (
        <>{!showChatbot && (
          <Suspense fallback={null}>
            <ChatBot />
          </Suspense>
        )}</>
      );`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    expect(containsGatedChatBotSuspense(invertedGateSource)).toBe(false);

    const decoyAndInvertedGateSource = ts.createSourceFile(
      'decoy-and-inverted-chatbot-gate.tsx',
      `const AppGlobals = ({ showChatbot }) => (
        <>
          {showChatbot && (
            <Suspense fallback={null}>
              <ChatBot />
            </Suspense>
          )}
          {!showChatbot && (
            <Suspense fallback={null}>
              <ChatBot />
            </Suspense>
          )}
        </>
      );`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    expect(containsGatedChatBotSuspense(decoyAndInvertedGateSource)).toBe(false);

    const selfClosingDecoyAndOrdinaryInvertedGateSource = ts.createSourceFile(
      'self-closing-decoy-and-ordinary-inverted-chatbot-gate.tsx',
      `const AppGlobals = ({ showChatbot }) => (
        <>
          {showChatbot && (
            <Suspense fallback={null}>
              <ChatBot />
            </Suspense>
          )}
          {!showChatbot && (
            <Suspense fallback={null}>
              <ChatBot></ChatBot>
            </Suspense>
          )}
        </>
      );`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    expect(containsGatedChatBotSuspense(selfClosingDecoyAndOrdinaryInvertedGateSource)).toBe(false);
  });

  it('keeps the legacy Competition redirect out of the eager route shell', () => {
    const appRoutesSource = readFileSync(new URL('../src/app/AppRoutes.tsx', import.meta.url), 'utf8');
    const sourceFile = ts.createSourceFile(
      'AppRoutes.tsx',
      appRoutesSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const staticLegacyRedirectImports = sourceFile.statements.filter(
      (statement) => ts.isImportDeclaration(statement)
        && ts.isStringLiteral(statement.moduleSpecifier)
        && getModuleBasename(statement.moduleSpecifier.text) === 'LegacyCompetitionRedirect',
    );
    expect(staticLegacyRedirectImports).toHaveLength(0);
    expect(findLegacyCompetitionRedirectLazyDeclarations(sourceFile)).toEqual({
      totalDeclarationCount: 1,
      validLazyDeclarationCount: 1,
    });

    const discardedImportSource = ts.createSourceFile(
      'discarded-import.tsx',
      `const LegacyCompetitionRedirect = React.lazy(() => {
        import('../features/competition/portal/student/LegacyCompetitionRedirect');
        return Promise.resolve({ default: () => null });
      });`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    expect(findLegacyCompetitionRedirectLazyDeclarations(discardedImportSource)).toEqual({
      totalDeclarationCount: 1,
      validLazyDeclarationCount: 0,
    });
  });

  it('keeps Competition portal SEO out of the eager app shell', () => {
    const appSource = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
    const sourceFile = ts.createSourceFile(
      'App.tsx',
      appSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const staticCompetitionSeoImports = sourceFile.statements.filter(
      (statement) => ts.isImportDeclaration(statement)
        && ts.isStringLiteral(statement.moduleSpecifier)
        && getModuleBasename(statement.moduleSpecifier.text) === 'useCompetitionPortalSeo',
    );
    expect(staticCompetitionSeoImports).toHaveLength(0);

    const dynamicBoundaryImports = collectDynamicImportSpecifiers(sourceFile);
    expect(dynamicBoundaryImports.map(getModuleBasename)).toContain('CompetitionPortalSeoBoundary');
    expect(findLazyBoundaryDeclarations(sourceFile)).toBeGreaterThan(0);

    const routeGates = findCompetitionRouteGates(sourceFile);
    expect(routeGates.length).toBeGreaterThan(0);
    const mainAppReturnExpression = findMainAppReturnExpression(sourceFile);
    expect(mainAppReturnExpression).toBeDefined();
    if (!mainAppReturnExpression) {
      return;
    }
    const coupledRouteGates = findCoupledRouteGates(
      mainAppReturnExpression,
      new Set(routeGates.map(({ name }) => name)),
    );
    expect(routeGates.some(({ name }) => coupledRouteGates.has(name))).toBe(true);
  });

  it('treats the Competition rollout flag as an explicit release contract', () => {
    const env = {
      VITE_FEATURE_GIFT_SHOP_V2: 'false',
      VITE_FEATURE_AI_QUIZ_V2: 'false',
      VITE_FEATURE_AI_BLUEPRINT_V3: 'false',
      VITE_FEATURE_AI_SVG_DIAGRAMS: 'false',
      VITE_FEATURE_PARENT_PORTAL_V1: 'false',
      VITE_FEATURE_COMPETITION_V1: 'false',
      VITE_GIFT_SHOP_MODE: 'api',
    };
    expect(validateReleaseFlags(env)).toEqual([]);
    expect(validateReleaseFlags({ ...env, VITE_FEATURE_COMPETITION_V1: 'maybe' }))
      .toContain('VITE_FEATURE_COMPETITION_V1 must be true or false');
  });

  it('requires certified capacity evidence and an explicit rollback SHA before rollout', () => {
    expect(validateCompetitionReleaseArtifacts({ VITE_FEATURE_COMPETITION_V1: 'false' })).toEqual([]);
    expect(validateCompetitionReleaseArtifacts({ VITE_FEATURE_COMPETITION_V1: 'true' }))
      .toEqual(expect.arrayContaining([
        expect.stringContaining('COMPETITION_CAPACITY_REPORT'),
        expect.stringContaining('COMPETITION_RELEASE_SHA'),
        expect.stringContaining('COMPETITION_ROLLBACK_SHA'),
        expect.stringContaining('COMPETITION_ROLLOUT_STAGE'),
      ]));

    const directory = mkdtempSync(join(tmpdir(), 'competition-release-'));
    const reportPath = join(directory, 'capacity.json');
    writeFileSync(reportPath, JSON.stringify(greenCapacityReport), 'utf8');
    try {
      expect(validateCompetitionReleaseArtifacts({
        VITE_FEATURE_COMPETITION_V1: 'true',
        COMPETITION_CAPACITY_REPORT: reportPath,
        COMPETITION_RELEASE_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        COMPETITION_ROLLBACK_SHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        COMPETITION_ROLLOUT_STAGE: 'internal',
      })).toEqual([]);

      expect(validateCompetitionReleaseArtifacts({
        VITE_FEATURE_COMPETITION_V1: 'true',
        COMPETITION_CAPACITY_REPORT: reportPath,
        COMPETITION_RELEASE_SHA: 'cccccccccccccccccccccccccccccccccccccccc',
        COMPETITION_ROLLBACK_SHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        COMPETITION_ROLLOUT_STAGE: 'canary',
      })).toContain('COMPETITION_CAPACITY_REPORT build SHA must match COMPETITION_RELEASE_SHA');

      expect(validateCompetitionReleaseArtifacts({
        VITE_FEATURE_COMPETITION_V1: 'true',
        COMPETITION_CAPACITY_REPORT: reportPath,
        COMPETITION_RELEASE_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        COMPETITION_ROLLBACK_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        COMPETITION_ROLLOUT_STAGE: 'production',
      })).toEqual(expect.arrayContaining([
        'COMPETITION_ROLLBACK_SHA must differ from COMPETITION_RELEASE_SHA',
        'COMPETITION_ROLLOUT_STAGE must be internal, canary, or school-wide',
      ]));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('sanitizes structured operational events without answers or credentials', () => {
    const sanitized = sanitizeCompetitionLogMetadata({
      operation: 'student_round_attempt_submit',
      campaignId: 'campaign-1',
      eventId: 'event-1',
      status: 200,
      answers: { q1: 'A' },
      token: 'secret-token',
      nested: { requestId: 'req-1', password: 'secret-password' },
    });
    expect(sanitized).toEqual({
      operation: 'student_round_attempt_submit',
      campaignId: 'campaign-1',
      eventId: 'event-1',
      status: 200,
      nested: { requestId: 'req-1' },
    });

    const sink = { info: vi.fn(), warn: vi.fn() };
    const logger = createCompetitionEventLogger(sink);
    logger.info('mutation_completed', { operation: 'school_exam_publish', campaignId: 'campaign-1' });
    expect(sink.info).toHaveBeenCalledWith('[Competition] mutation_completed', {
      operation: 'school_exam_publish', campaignId: 'campaign-1',
    });
  });

  it('wires Competition regression, capacity, E2E and rollback guidance into release readiness', () => {
    expect(REQUIRED_RELEASE_CHECKS).toEqual(expect.arrayContaining([
      'competition-regression',
      'competition-capacity',
      'competition-e2e',
    ]));
    const workflow = readFileSync('.github/workflows/release-readiness.yml', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const runbook = readFileSync('docs/operations/competition-v1-rollout.md', 'utf8');
    expect(workflow).toContain('VITE_FEATURE_COMPETITION_V1');
    expect(workflow).toContain('Verify Competition V1 release contracts');
    expect(packageJson.scripts['cypress:run:stubbed']).toContain('competition-v1.cy.ts');
    expect(runbook).toContain('COMPETITION_CAPACITY_REPORT');
    expect(runbook).toContain('COMPETITION_RELEASE_SHA');
    expect(runbook).toContain('COMPETITION_ROLLBACK_SHA');
    expect(runbook).toContain('COMPETITION_ROLLOUT_STAGE');
    expect(runbook).toContain('0079_competition_runtime_rollout.sql');
    expect(runbook).toContain('0079 to 0069');
    expect(runbook).toContain('internal → canary → school-wide');
    expect(runbook).toContain('VITE_FEATURE_COMPETITION_V1=false');
  });

  it('enables Competition V1 for the pull-request Cypress job that runs its stubbed journey', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const stubbedJob = workflow.slice(
      workflow.indexOf('  e2e-stubbed:'),
      workflow.indexOf('  e2e-blueprint-v3:'),
    );

    expect(stubbedJob).toContain('command: npm run cypress:run:stubbed');
    expect(stubbedJob).toContain("VITE_FEATURE_COMPETITION_V1: 'true'");
    expect(stubbedJob).toContain("VITE_FEATURE_COMPETITION_STUDENT_PORTAL_V1: 'true'");
  });

});
