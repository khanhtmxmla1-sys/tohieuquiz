import React, { useState } from 'react';
import { Modal } from '../../src/components/common/Modal';

const Harness = () => {
    const [open, setOpen] = useState(true);
    return <><button onClick={() => setOpen(true)}>Mở</button><Modal isOpen={open} onClose={() => setOpen(false)} title="Xác nhận"><button>Đồng ý</button></Modal></>;
};

describe('accessible modal', () => {
    it('supports keyboard close and labelled dialog semantics', () => {
        cy.mount(<Harness />);
        cy.get('[role="dialog"]').should('have.attr', 'aria-modal', 'true');
        cy.get('button[aria-label="Đóng"]').should('be.focused');
        cy.get('body').type('{esc}');
        cy.get('[role="dialog"]').should('not.exist');
    });
});
