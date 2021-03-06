/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  CancelResponse,
  CommandletExecutor,
  CompositeParametersGatherer,
  ContinueResponse,
  EmptyParametersGatherer,
  ParametersGatherer,
  SelectDirPath,
  SfdxCommandlet
} from '../../src/commands/commands';

// tslint:disable:no-unused-expression
describe('Command Utilities', () => {
  const WORKSPACE_NAME = 'sfdx-simple';
  const SFDX_SIMPLE_NUM_OF_DIRS = 11;
  describe('EmptyParametersGatherer', () => {
    it('Should always return continue with empty object as data', async () => {
      const gatherer = new EmptyParametersGatherer();
      const response = await gatherer.gather();
      expect(response.type).to.be.eql('CONTINUE');

      const continueResponse = response as ContinueResponse<{}>;
      expect(continueResponse.data).to.be.eql({});
    });
  });

  describe('SfdxCommandlet', () => {
    it('Should not proceed if checker fails', async () => {
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return false;
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            throw new Error('This should not be called');
          }
        }(),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            throw new Error('This should not be called');
          }
        }()
      );

      await commandlet.run();
    });

    it('Should not call executor if gatherer is CANCEL', async () => {
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return true;
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CANCEL' };
          }
        }(),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            throw new Error('This should not be called');
          }
        }()
      );

      await commandlet.run();
    });

    it('Should call executor if gatherer is CONTINUE', async () => {
      let executed = false;
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return true;
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CONTINUE', data: {} };
          }
        }(),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            executed = true;
          }
        }()
      );

      await commandlet.run();

      expect(executed).to.be.true;
    });
  });

  describe('CompositeParametersGatherer', () => {
    it('Should proceed to next gatherer if previous gatherer in composite gatherer is CONTINUE', async () => {
      const compositeParameterGatherer = new CompositeParametersGatherer(
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CONTINUE', data: {} };
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CONTINUE', data: {} };
          }
        }()
      );

      const response = await compositeParameterGatherer.gather();
      expect(response.type).to.equal('CONTINUE');
    });

    it('Should not proceed to next gatherer if previous gatherer in composite gatherer is CANCEL', async () => {
      const compositeParameterGatherer = new CompositeParametersGatherer(
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CANCEL' };
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            throw new Error('This should not be called');
          }
        }()
      );

      await compositeParameterGatherer.gather();
    });

    it('Should call executor if composite gatherer is CONTINUE', async () => {
      let executed = false;
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return true;
          }
        }(),
        new CompositeParametersGatherer(
          new class implements ParametersGatherer<{}> {
            public async gather(): Promise<
              CancelResponse | ContinueResponse<{}>
            > {
              return { type: 'CONTINUE', data: {} };
            }
          }()
        ),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            executed = true;
          }
        }()
      );

      await commandlet.run();

      expect(executed).to.be.true;
    });

    it('Should not call executor if composite gatherer is CANCEL', async () => {
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return true;
          }
        }(),
        new CompositeParametersGatherer(
          new class implements ParametersGatherer<{}> {
            public async gather(): Promise<
              CancelResponse | ContinueResponse<{}>
            > {
              return { type: 'CANCEL' };
            }
          }()
        ),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            throw new Error('This should not be called');
          }
        }()
      );

      await commandlet.run();
    });
  });

  describe('Prioritized Glob Directories', () => {
    it('Glob dirs returns correct number of directories and relative path', async () => {
      const dirPathGatherer = new SelectDirPath();
      if (!vscode.workspace.rootPath) {
        throw new Error('Test workspace should be opened');
      }
      const dirList: string[] = dirPathGatherer.globDirs(
        vscode.workspace.rootPath
      );
      expect(dirList[0]).to.not.contain(WORKSPACE_NAME);
      expect(dirList.length).to.equal(SFDX_SIMPLE_NUM_OF_DIRS);
    });

    it('Glob dirs moves dirs containing the keyword to the top of list and give relative path to workspace', async () => {
      const dirPathGatherer = new SelectDirPath();
      if (!vscode.workspace.rootPath) {
        throw new Error('Test workspace should be opened');
      }
      const dirList: string[] = dirPathGatherer.globDirs(
        vscode.workspace.rootPath,
        'classes'
      );
      expect(dirList[0]).to.equal(
        path.join('force-app', 'main', 'default', 'classes')
      );
      expect(dirList[1]).to.equal(
        path.join('force-app', 'test', 'default', 'classes')
      );
    });
  });
});
