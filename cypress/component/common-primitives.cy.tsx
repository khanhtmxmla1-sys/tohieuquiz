import React from 'react';
import { Alert, Button, Input } from '../../src/components/common';

describe('common primitives', () => {
    it('renders accessible interactive states', () => {
        cy.mount(<div className="space-y-4"><Input label="Tên lớp" error="Bắt buộc" /><Alert tone="warning">Cần kiểm tra</Alert><Button loading>Đang lưu</Button></div>);
        cy.get('input[aria-invalid="true"]').should('exist');
        cy.get('[role="status"]').should('contain.text', 'Cần kiểm tra');
        cy.contains('button', 'Đang lưu').should('be.disabled').and('have.attr', 'aria-busy', 'true');
    });
});
