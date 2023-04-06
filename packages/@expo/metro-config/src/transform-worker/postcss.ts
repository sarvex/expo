/**
 * Copyright © 2023 650 Industries.
 * Copyright JS Foundation and other contributors
 *
 * https://github.com/webpack-contrib/postcss-loader/
 */
import JsonFile from '@expo/json-file';
import fs from 'fs';
import type { BabelTransformerArgs } from 'metro-babel-transformer';
import path from 'path';
import type { AcceptedPlugin, ProcessOptions } from 'postcss';
import resolveFrom from 'resolve-from';

type PostCSSInputConfig = {
  plugins?: any[];
  from?: string;
  to?: string;
  syntax?: string;
  map?: boolean;
  parser?: string;
  stringifier?: string;
};

const CONFIG_FILE_NAME = 'postcss.config';

const debug = require('debug')('expo:metro:transformer:postcss');

export async function transformPostCssModule(
  projectRoot: string,
  { src, filename }: { src: string; filename: string }
): Promise<string> {
  const inputConfig = resolvePostcssConfig(projectRoot);

  if (!inputConfig) {
    return src;
  }

  return await processWithPostcssInputConfigAsync(projectRoot, {
    inputConfig,
    src,
    filename,
  });
}

async function processWithPostcssInputConfigAsync(
  projectRoot: string,
  { src, filename, inputConfig }: { src: string; filename: string; inputConfig: PostCSSInputConfig }
) {
  const { plugins, processOptions } = await parsePostcssConfigAsync(projectRoot, {
    config: inputConfig,
    resourcePath: filename,
  });

  debug('options:', processOptions);
  debug('plugins:', plugins);

  // TODO: Surely this can be cached...
  const postcss = await import('postcss');
  const processor = postcss.default(plugins);
  const { content } = await processor.process(src, processOptions);

  return content;
}

async function parsePostcssConfigAsync(
  projectRoot: string,
  {
    resourcePath: file,
    config: { plugins: inputPlugins, map, parser, stringifier, syntax, ...config } = {},
  }: {
    resourcePath: string;
    config: PostCSSInputConfig;
  }
): Promise<{ plugins: AcceptedPlugin[]; processOptions: ProcessOptions }> {
  const factory = pluginFactory();

  factory(inputPlugins);
  // delete config.plugins;

  const plugins = [...factory()].map((item) => {
    const [plugin, options] = item;

    if (typeof plugin === 'string') {
      return loadPlugin(projectRoot, plugin, options, file);
    }

    return plugin;
  });

  if (config.from) {
    config.from = path.resolve(projectRoot, config.from);
  }

  if (config.to) {
    config.to = path.resolve(projectRoot, config.to);
  }

  const processOptions: Partial<ProcessOptions> = {
    from: file,
    to: file,
    map: false,
  };

  if (typeof parser === 'string') {
    try {
      processOptions.parser = await tryRequireThenImport(parser);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          `Loading PostCSS "${parser}" parser failed: ${error.message}\n\n(@${file})`
        );
      }
      throw error;
    }
  }

  if (typeof stringifier === 'string') {
    try {
      processOptions.stringifier = await tryRequireThenImport(stringifier);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          `Loading PostCSS "${stringifier}" stringifier failed: ${error.message}\n\n(@${file})`
        );
      }
      throw error;
    }
  }

  if (typeof syntax === 'string') {
    try {
      processOptions.syntax = await tryRequireThenImport(syntax);
    } catch (error: any) {
      throw new Error(`Loading PostCSS "${syntax}" syntax failed: ${error.message}\n\n(@${file})`);
    }
  }

  if (map === true) {
    // https://github.com/postcss/postcss/blob/master/docs/source-maps.md
    processOptions.map = { inline: true };
  }

  return { plugins, processOptions };
}

async function tryRequireThenImport<TModule>(moduleId: string): Promise<TModule> {
  try {
    return require(moduleId);
  } catch (requireError: any) {
    let importESM;
    try {
      // eslint-disable-next-line no-new-func
      importESM = new Function('id', 'return import(id);');
    } catch {
      importESM = null;
    }

    if (requireError?.code === 'ERR_REQUIRE_ESM' && importESM) {
      return (await importESM(moduleId)).default;
    }

    throw requireError;
  }
}

function loadPlugin(projectRoot: string, plugin: string, options: unknown, file: string) {
  try {
    debug('load plugin:', plugin);

    // e.g. `tailwindcss`
    let loadedPlugin = require(resolveFrom(projectRoot, plugin));

    if (loadedPlugin.default) {
      loadedPlugin = loadedPlugin.default;
    }

    if (!options || !Object.keys(options).length) {
      return loadedPlugin;
    }

    return loadedPlugin(options);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Loading PostCSS "${plugin}" plugin failed: ${error.message}\n\n(@${file})`);
    }
    throw error;
  }
}

function pluginFactory() {
  const listOfPlugins = new Map<string, any>();

  return (plugins?: any) => {
    if (typeof plugins === 'undefined') {
      return listOfPlugins;
    }

    if (Array.isArray(plugins)) {
      for (const plugin of plugins) {
        if (Array.isArray(plugin)) {
          const [name, options] = plugin;

          listOfPlugins.set(name, options);
        } else if (plugin && typeof plugin === 'function') {
          listOfPlugins.set(plugin, undefined);
        } else if (
          plugin &&
          Object.keys(plugin).length === 1 &&
          (typeof plugin[Object.keys(plugin)[0]] === 'object' ||
            typeof plugin[Object.keys(plugin)[0]] === 'boolean') &&
          plugin[Object.keys(plugin)[0]] !== null
        ) {
          const [name] = Object.keys(plugin);
          const options = plugin[name];

          if (options === false) {
            listOfPlugins.delete(name);
          } else {
            listOfPlugins.set(name, options);
          }
        } else if (plugin) {
          listOfPlugins.set(plugin, undefined);
        }
      }
    } else {
      const objectPlugins = Object.entries(plugins);

      for (const [name, options] of objectPlugins) {
        if (options === false) {
          listOfPlugins.delete(name);
        } else {
          listOfPlugins.set(name, options);
        }
      }
    }

    return listOfPlugins;
  };
}

function requireUncachedPostcssFile(moduleId: string) {
  try {
    delete require.cache[require.resolve(moduleId)];
  } catch {}
  try {
    return require(moduleId);
  } catch (error: unknown) {
    if (error instanceof Error) {
      error.message = `Cannot load postcss config file ${moduleId}: ${error.message}`;
    }
    throw error;
  }
}

function resolvePostcssConfig(projectRoot: string): PostCSSInputConfig | null {
  // TODO: Maybe support platform-specific postcss config files in the future.
  const jsConfigPath = path.join(projectRoot, CONFIG_FILE_NAME + '.js');

  if (fs.existsSync(jsConfigPath)) {
    debug('load file:', jsConfigPath);
    return requireUncachedPostcssFile(jsConfigPath);
  }

  const jsonConfigPath = path.join(projectRoot, CONFIG_FILE_NAME + '.json');

  if (fs.existsSync(jsonConfigPath)) {
    debug('load file:', jsonConfigPath);
    return JsonFile.read(jsonConfigPath, { json5: true });
  }

  return null;
}
